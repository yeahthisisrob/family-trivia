// File: services/bedrock/questions/utils.ts
// Purpose: Utility functions for question generation and deduplication

import { Question } from '../core/types';
import { MAX_RETRY_ATTEMPTS } from '../core/constants';
import { invokeBedrockPrompt } from '../core/bedrockClient';
import { collectResponseBody, extractJsonFromResponse } from '../core/responseParser';
import { logger } from '../../../services/logger';
import { getJson } from '../../s3';
import { checkTopicDuplicate } from '../../topicSimilarityService';

interface DuplicateCheckResult {
  isDuplicate: boolean;
  matchMethod?: string;
  similarity?: number;
  details?: any;
}

/**
 * Get previous questions for a specific custom category from the current user
 */
export async function getPreviousCustomCategoryQuestions(
  category: string,
  userId: string
): Promise<string[]> {
  const categoryQuestions: string[] = [];
  
  // Only process if this is a custom category
  if (!category || (!category.includes('Custom:') && !category.startsWith('Custom:'))) {
    return categoryQuestions;
  }
  
  logger.info('Collecting previous custom category questions for user', { 
    category, 
    userId 
  });
  
  try {
    const userHistory = await getJson<any[]>(`answers/history/${userId}.json`) || [];
    
    // Filter for questions matching this custom category
    const customQuestions = userHistory
      .filter(entry => {
        const q = entry.question;
        return q && 
               q.category === category && 
               (q.isCustomCategory === true || q.category.includes('Custom:'));
      })
      .map(entry => entry.question.question);
    
    categoryQuestions.push(...customQuestions);
  } catch (err) {
    // Skip if we can't read user's history
    logger.debug('Could not read user history for custom questions', { userId });
  }
  
  logger.info('Found previous custom category questions', { 
    category, 
    userId,
    count: categoryQuestions.length 
  });
  
  // Return last 25 questions to keep prompt reasonable
  return categoryQuestions.slice(-25);
}

/**
 * Clean and normalize text for comparison
 */
export function cleanText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')   // Remove punctuation
    .replace(/\s+/g, ' ')      // Normalize whitespace
    .trim();
}

/**
 * Calculate semantic similarity between two texts using word overlap
 */
function calculateWordSimilarity(text1: string, text2: string): number {
  const words1 = cleanText(text1).split(' ').filter(w => w.length > 2);
  const words2 = cleanText(text2).split(' ').filter(w => w.length > 2);
  
  if (words1.length === 0 || words2.length === 0) return 0;
  
  const commonWords = words1.filter(w => words2.includes(w));
  return commonWords.length / Math.max(words1.length, words2.length);
}

/**
 * Extract significant phrases that indicate the core topic
 */
export function extractSignificantPhrases(text: string): string[] {
  const phrases = new Set<string>();
  const lower = text.toLowerCase();

  // 1. Quoted content (strong indicator)
  const quoteRe = /["']([^"']{3,})["']/g;
  for (const m of lower.matchAll(quoteRe)) {
    phrases.add(m[1].trim());
  }

  // 2. Named entities and important concepts
  const patterns: RegExp[] = [
    // Geography patterns - more comprehensive
    /\b(?:capital|city|town|country|nation|state|province|continent) (?:of |in |is |was )?([A-Za-z][A-Za-z\s]{2,20})(?:\b|$)/gi,
    /\b(?:river|mountain|lake|ocean|sea|desert|forest|island) ([A-Za-z][A-Za-z\s]{2,20})(?:\b|$)/gi,
    /\blocated in ([A-Za-z][A-Za-z\s]{2,20})(?:\b|$)/gi,
    /\bborders? ([A-Za-z][A-Za-z\s]{2,20})(?:\b|$)/gi,
    
    // Entertainment and media
    /\b(?:movie|film|book|novel|tv show|series|album|song) (?:called |titled |named )?['"]?([^'"]{3,30})['"]?/gi,
    /\bwrote ['"]?([^'"]{3,30})['"]?/gi,
    /\bdirected ['"]?([^'"]{3,30})['"]?/gi,
    /\bstarring ([A-Za-z][A-Za-z\s]{3,25})/gi,
    
    // Science and nature
    /\b(?:planet|moon|star|galaxy|element|compound|species|disease) (?:called |named )?([A-Za-z][A-Za-z\s]{2,20})(?:\b|$)/gi,
    /\batmosphere of ([A-Za-z][A-Za-z\s]{2,15})/gi,
    /\b(?:discovered|invented|created) (?:by |in )?([A-Za-z][A-Za-z\s]{3,25})(?:\b|$)/gi,
    
    // Historical events and people
    /\b(?:battle|war|revolution|treaty|empire) (?:of |in |at )?([A-Za-z][A-Za-z\s]{2,20})(?:\b|$)/gi,
    /\b(?:emperor|king|queen|president|leader) (?:of )?([A-Za-z][A-Za-z\s]{3,25})(?:\b|$)/gi,
    /\breigned (?:over |in )?([A-Za-z][A-Za-z\s]{2,20})(?:\b|$)/gi,
    
    // Sports and achievements
    /\bwon (?:the )?([A-Za-z][A-Za-z\s]{3,25})(?:\b|$)/gi,
    /\bchampion(?:ship)? (?:of |in )?([A-Za-z][A-Za-z\s]{2,20})(?:\b|$)/gi,
    /\brecord (?:in |for )?([A-Za-z][A-Za-z\s]{2,20})(?:\b|$)/gi,
    
    // Technology and inventions
    /\binvention (?:of |called )?([A-Za-z][A-Za-z\s]{2,20})(?:\b|$)/gi,
    /\btechnology (?:called |named )?([A-Za-z][A-Za-z\s]{2,20})(?:\b|$)/gi
  ];

  for (const re of patterns) {
    for (const m of lower.matchAll(re)) {
      if (m[1] && m[1].trim().length > 2) {
        phrases.add(m[1].trim());
      }
    }
  }

  // Also extract standalone important nouns (fallback)
  const importantWords = /\b(?:olymp\w+|championship|university|foundation|institute|organization|government|parliament|congress|senate|constitution|amendment|declaration|treaty|alliance|federation|republic|kingdom|empire|dynasty)\b/gi;
  for (const m of lower.matchAll(importantWords)) {
    phrases.add(m[0]);
  }

  return Array.from(phrases).filter(p => p.length > 2);
}

/**
 * Determine if two questions have the same semantic structure
 */
function haveSimilarStructure(q1: string, q2: string): boolean {
  const questionTypes = [
    'what', 'which', 'who', 'when', 'where', 'how many', 'how much', 
    'how long', 'how often', 'why', 'how', 'can you name', 'name the'
  ];
  
  const clean1 = cleanText(q1);
  const clean2 = cleanText(q2);
  
  const type1 = questionTypes.find(t => clean1.startsWith(t)) || '';
  const type2 = questionTypes.find(t => clean2.startsWith(t)) || '';
  
  return type1 !== '' && type1 === type2;
}

/**
 * Get category-specific thresholds for duplicate detection
 */
function getCategoryThresholds(category?: string): {
  phraseThreshold: number;
  wordOverlapThreshold: number;
  structureOverlapThreshold: number;
  minPhraseLength: number;
} {
  const cat = category?.toLowerCase() || '';
  
  // Geography questions need stricter thresholds due to limited entity pools
  if (cat.includes('geography') || cat.includes('location')) {
    return {
      phraseThreshold: 2,        // Need at least 2 significant phrases
      wordOverlapThreshold: 0.85, // 85% word overlap
      structureOverlapThreshold: 0.75, // 75% for structure similarity
      minPhraseLength: 3
    };
  }
  
  // History questions can be more lenient as events are more unique
  if (cat.includes('history') || cat.includes('historical')) {
    return {
      phraseThreshold: 1,        // Single significant phrase can indicate duplicate
      wordOverlapThreshold: 0.8,
      structureOverlapThreshold: 0.7,
      minPhraseLength: 4
    };
  }
  
  // Science questions need moderate strictness
  if (cat.includes('science') || cat.includes('nature') || cat.includes('biology')) {
    return {
      phraseThreshold: 2,
      wordOverlapThreshold: 0.8,
      structureOverlapThreshold: 0.7,
      minPhraseLength: 3
    };
  }
  
  // Entertainment can be more lenient due to unique titles
  if (cat.includes('entertainment') || cat.includes('movie') || cat.includes('music')) {
    return {
      phraseThreshold: 1,
      wordOverlapThreshold: 0.75,
      structureOverlapThreshold: 0.65,
      minPhraseLength: 4
    };
  }
  
  // Default thresholds for other categories
  return {
    phraseThreshold: 2,
    wordOverlapThreshold: 0.8,
    structureOverlapThreshold: 0.7,
    minPhraseLength: 3
  };
}

/**
 * Check if two questions are duplicates with detailed result
 */
export function isDuplicateQuestionDetailed(
  newQuestion: Question,
  previousQuestions: Question[]
): DuplicateCheckResult {
  if (!previousQuestions?.length) {
    return { isDuplicate: false };
  }

  const newClean = cleanText(newQuestion.question);
  const newPhrases = extractSignificantPhrases(newQuestion.question);
  const thresholds = getCategoryThresholds(newQuestion.category);

  for (const prev of previousQuestions) {
    const prevClean = cleanText(prev.question);
    const prevPhrases = extractSignificantPhrases(prev.question);

    // Method 1: Exact normalized match
    if (newClean === prevClean) {
      logger.info('Exact duplicate detected', { 
        new: newQuestion.question, 
        prev: prev.question,
        category: newQuestion.category
      });
      return {
        isDuplicate: true,
        matchMethod: 'exact_match',
        similarity: 1.0,
        details: { newClean, prevClean }
      };
    }

    // Method 2: Significant phrase overlap
    const sharedPhrases = newPhrases.filter(p => 
      p.length >= thresholds.minPhraseLength && 
      prevPhrases.some(pp => pp.includes(p) || p.includes(pp))
    );
    
    if (sharedPhrases.length >= thresholds.phraseThreshold) {
      const similarity = sharedPhrases.length / Math.max(newPhrases.length, prevPhrases.length);
      logger.info('Phrase overlap duplicate detected', { 
        new: newQuestion.question, 
        prev: prev.question, 
        sharedPhrases, 
        sharedCount: sharedPhrases.length,
        threshold: thresholds.phraseThreshold,
        category: newQuestion.category,
        similarity
      });
      return {
        isDuplicate: true,
        matchMethod: 'phrase_overlap',
        similarity,
        details: { sharedPhrases, newPhrases, prevPhrases, threshold: thresholds.phraseThreshold }
      };
    }

    // Method 3: Structure similarity + moderate phrase overlap
    if (sharedPhrases.length >= 1 && haveSimilarStructure(newQuestion.question, prev.question)) {
      const wordSimilarity = calculateWordSimilarity(newQuestion.question, prev.question);
      if (wordSimilarity >= thresholds.structureOverlapThreshold) {
        logger.info('Structure + phrase duplicate detected', { 
          new: newQuestion.question, 
          prev: prev.question, 
          wordSimilarity, 
          threshold: thresholds.structureOverlapThreshold,
          category: newQuestion.category,
          sharedPhrase: sharedPhrases[0]
        });
        return {
          isDuplicate: true,
          matchMethod: 'structure_similarity',
          similarity: wordSimilarity,
          details: { 
            wordSimilarity, 
            threshold: thresholds.structureOverlapThreshold, 
            sharedPhrase: sharedPhrases[0],
            sameStructure: true
          }
        };
      }
    }

    // Method 4: Very high word overlap for longer questions
    const newWords = newClean.split(' ').filter(w => w.length > 3);
    const prevWords = prevClean.split(' ').filter(w => w.length > 3);
    
    if (newWords.length >= 5 && prevWords.length >= 5) {
      const wordSimilarity = calculateWordSimilarity(newQuestion.question, prev.question);
      if (wordSimilarity >= thresholds.wordOverlapThreshold) {
        logger.info('High word overlap duplicate detected', { 
          new: newQuestion.question, 
          prev: prev.question, 
          wordSimilarity, 
          threshold: thresholds.wordOverlapThreshold,
          category: newQuestion.category,
          wordCount: Math.min(newWords.length, prevWords.length)
        });
        return {
          isDuplicate: true,
          matchMethod: 'word_overlap',
          similarity: wordSimilarity,
          details: { 
            wordSimilarity, 
            threshold: thresholds.wordOverlapThreshold,
            totalWords: Math.min(newWords.length, prevWords.length)
          }
        };
      }
    }
  }

  return { isDuplicate: false };
}

/**
 * Check if two questions are duplicates.
 * Runs fuse.js topic matching first (fast, <5ms), then falls through to
 * the 4-method text comparison in isDuplicateQuestionDetailed.
 */
export function isDuplicateQuestion(
  newQuestion: Question,
  previousQuestions: Question[]
): boolean {
  // Fast topic-level check first — catches "two Kodak questions" scenario
  const topicResult = checkTopicDuplicate(newQuestion, previousQuestions);
  if (topicResult.isTopicDuplicate) return true;

  // Fall through to existing text-comparison methods
  return isDuplicateQuestionDetailed(newQuestion, previousQuestions).isDuplicate;
}

/**
 * Detailed duplicate check combining topic matching + text methods.
 * Returns match method and details for debugging.
 */
export function isDuplicateWithTopicCheck(
  newQuestion: Question,
  previousQuestions: Question[]
): DuplicateCheckResult {
  // Topic check
  const topicResult = checkTopicDuplicate(newQuestion, previousQuestions);
  if (topicResult.isTopicDuplicate) {
    return {
      isDuplicate: true,
      matchMethod: 'topic_overlap',
      similarity: 1 - topicResult.score,
      details: {
        matchedTopics: topicResult.matchedTopics,
        matchedQuestion: topicResult.matchedQuestion,
      },
    };
  }

  // Fall through to text-comparison methods
  return isDuplicateQuestionDetailed(newQuestion, previousQuestions);
}

/**
 * String-based wrapper
 */
export function isDuplicateQuestionString(
  newQ: string,
  prevQs: string[]
): boolean {
  const wrap = (q: string): Question => ({
    question: q,
    choices: [],
    answer: '',
    category: '',
    difficulty: 'normal',
    pointMultiplier: 1
  });
  return isDuplicateQuestion(wrap(newQ), prevQs.map(wrap));
}

/**
 * Generate a 4-option multiple choice question from a fact
 */
export async function generateMultipleChoiceFromFact(
  factQuestion: string,
  factAnswer: string,
  personName?: string,
): Promise<{ question: string; choices: string[]; answer: string }> {
  const nameInstruction = personName
    ? `\n5. Use "${personName}" by name in the question (NOT "[Family Member]" or placeholders)`
    : '';
  const prompt = `
You are helping create a family trivia game. Convert this fact into a multiple choice question about ${personName || 'a family member'}:

Original fact question: ${factQuestion}
Original fact answer: ${factAnswer}

Create a fun multiple choice question based on this fact. The question should:
1. Be clear and unambiguous
2. Have exactly 4 answer choices
3. Have only one correct answer
4. Include plausible but incorrect alternatives${nameInstruction}

Return the response in this exact JSON format:
{
  "question": "Your multiple choice question here?",
  "choices": ["Choice A", "Choice B", "Choice C", "Choice D"],
  "answer": "The correct choice exactly as it appears in choices array"
}`;

  let attempt = 0;
  while (attempt < MAX_RETRY_ATTEMPTS) {
    attempt++;
    try {
      const temp = 0.7 + (attempt - 1) * 0.1;
      const stream = await invokeBedrockPrompt(prompt, 512, temp);
      const buf = await collectResponseBody(stream);

      let parsed = extractJsonFromResponse(buf);
      if (parsed.rawText) parsed = JSON.parse(parsed.rawText);
      if (!parsed.question || !Array.isArray(parsed.choices) || !parsed.answer) {
        throw new Error('Bad format');
      }
      if (parsed.choices.length !== 4 || !parsed.choices.includes(parsed.answer)) {
        throw new Error('Wrong choices count or missing answer');
      }

      logger.info('Generated MCQ', { length: parsed.question.length });
      return { question: parsed.question, choices: parsed.choices, answer: parsed.answer };
    } catch (err: any) {
      logger.error('Generation error', { attempt, err: err.message || err });
      if (attempt >= MAX_RETRY_ATTEMPTS) {
        throw new Error(`Failed after ${MAX_RETRY_ATTEMPTS} tries`);
      }
    }
  }
  // should never get here
  throw new Error('Unexpected failure in MCQ generation');
}
