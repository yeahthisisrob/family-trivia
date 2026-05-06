// File: lambda/services/topicSimilarityService.ts
// Purpose: Fast local topic/entity matching using fuse.js to catch
// subject-level duplicate questions that text-comparison misses.

import Fuse from 'fuse.js';
import { Question } from './bedrock/core/types';
import { extractSignificantPhrases } from './bedrock/questions/utils';
import { logger } from './logger';

// ── Types ─────────────────────────────────────────────────────────

export interface TopicDuplicateResult {
  isTopicDuplicate: boolean;
  matchedTopics: string[];
  score: number;
  matchedQuestion?: string;
}

interface TopicRecord {
  question: string;
  topics: string[];
  topicString: string;
  category: string;
}

// ── Topic Extraction ──────────────────────────────────────────────

/**
 * Extract key topics from a question.
 * Uses extractSignificantPhrases (regex patterns) + proper-noun extraction
 * for entities like "Kodak" that regexes might miss.
 */
export function extractTopics(questionText: string): string[] {
  const topics = new Set<string>();

  // 1. Use existing phrase extraction (regex patterns for geography, history, etc.)
  for (const phrase of extractSignificantPhrases(questionText)) {
    topics.add(phrase.toLowerCase());
  }

  // 2. Extract proper nouns — capitalized words not at sentence start
  //    Catches brand names (Kodak), people (Einstein), places not in regex patterns
  const sentences = questionText.split(/[.?!]/);
  for (const sentence of sentences) {
    const words = sentence.trim().split(/\s+/);
    for (let i = 1; i < words.length; i++) {
      const word = words[i].replace(/[^A-Za-z'-]/g, '');
      if (word.length >= 3 && /^[A-Z]/.test(word) && !/^(The|And|But|For|Not|Yet|All|Its|Has|Had|Was|Are|Can|Did|May|New|Old)$/.test(word)) {
        topics.add(word.toLowerCase());
      }
    }
  }

  // 3. Extract quoted terms
  const quoteRe = /["']([^"']{3,30})["']/g;
  for (const m of questionText.matchAll(quoteRe)) {
    topics.add(m[1].trim().toLowerCase());
  }

  // 4. Extract numbers with context (years, quantities)
  const yearRe = /\b(1[0-9]{3}|20[0-2][0-9])\b/g;
  for (const m of questionText.matchAll(yearRe)) {
    topics.add(m[1]);
  }

  return Array.from(topics).filter(t => t.length >= 2);
}

// ── Topic Duplicate Check ─────────────────────────────────────────

/**
 * Check if a question's topics overlap with any previous question's topics.
 * Uses fuse.js for fast fuzzy matching on the combined topic strings.
 */
export function checkTopicDuplicate(
  newQuestion: Question,
  previousQuestions: Question[],
): TopicDuplicateResult {
  if (!previousQuestions?.length) {
    return { isTopicDuplicate: false, matchedTopics: [], score: 0 };
  }

  const newTopics = extractTopics(newQuestion.question);
  if (newTopics.length === 0) {
    return { isTopicDuplicate: false, matchedTopics: [], score: 0 };
  }

  // Build records for fuse.js index
  const records: TopicRecord[] = previousQuestions.map(q => {
    const topics = extractTopics(q.question);
    return {
      question: q.question,
      topics,
      topicString: topics.join(' '),
      category: q.category || '',
    };
  });

  // Build fuse index — search the topicString field
  const fuse = new Fuse(records, {
    keys: ['topicString'],
    threshold: 0.4,         // 0 = exact, 1 = anything matches
    includeScore: true,
    minMatchCharLength: 3,
  });

  const newTopicString = newTopics.join(' ');
  const results = fuse.search(newTopicString);

  // Check top results for meaningful topic overlap
  for (const result of results.slice(0, 5)) {
    const record = result.item;
    const fuseScore = result.score ?? 1;

    // Direct topic overlap check: how many topics are shared?
    const sharedTopics = newTopics.filter(t =>
      record.topics.some(rt => rt === t || rt.includes(t) || t.includes(rt)),
    );

    // Need at least 2 shared topics, OR 1 shared topic that's very specific (>5 chars)
    // AND a good fuse score (< 0.3)
    const hasSignificantOverlap =
      (sharedTopics.length >= 2) ||
      (sharedTopics.length >= 1 && sharedTopics.some(t => t.length > 5) && fuseScore < 0.3);

    if (hasSignificantOverlap) {
      // Same category needs the same overlap threshold as cross-category.
      // The old threshold of 1 was too aggressive — with 1000+ questions
      // in the pool, common category terms (e.g., "river" in Geography)
      // caused false positives that blocked ALL new question generation.
      const threshold = 2;

      if (sharedTopics.length >= threshold) {
        logger.info('Topic duplicate detected', {
          newQuestion: newQuestion.question.substring(0, 60),
          matchedQuestion: record.question.substring(0, 60),
          sharedTopics,
          fuseScore,
        });
        return {
          isTopicDuplicate: true,
          matchedTopics: sharedTopics,
          score: fuseScore,
          matchedQuestion: record.question,
        };
      }
    }
  }

  return { isTopicDuplicate: false, matchedTopics: [], score: 1 };
}
