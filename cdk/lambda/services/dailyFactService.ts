// File: lambda/services/dailyFactService.ts
// Purpose: Daily fact question generation service.
// Loads ALL previous questions for dedup, uses best model, stores metadata.

import { getJson, putJson, listObjects, putJsonIfNotExists } from './s3';
import { S3_PATHS } from '../constants';
import { logger } from './logger';
import { AVAILABLE_MODELS } from '../config';
import { invokeBedrockPrompt } from './bedrock/core/bedrockClient';
import { collectResponseBody } from './bedrock/core/responseParser';
import { extractTextContent } from './bedrock/core/textExtractor';
import { isDuplicateQuestionString } from './bedrock/questions/utils';
import { getEasternDateString } from '@family-trivia/shared';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DailyFactQuestion {
  question: string;
  category: string;
  timestamp: string;
  date: string;
  questionType: 'shared';
  createdBy: string | null;       // userId of whoever generated it
  createdByFirstPerson: boolean;
  theme?: string;                 // theme/words the first person provided
}

// Categories for daily facts — exported for frontend use
export const FACT_CATEGORIES = [
  { id: 'favorites', label: 'Favorites', emoji: '⭐', hint: 'Preferences, top picks, go-tos' },
  { id: 'memories', label: 'Memories', emoji: '📸', hint: 'Childhood, nostalgia, moments' },
  { id: 'food', label: 'Food', emoji: '🍕', hint: 'Meals, cooking, guilty pleasures' },
  { id: 'travel', label: 'Travel', emoji: '✈️', hint: 'Trips, places, adventures' },
  { id: 'habits', label: 'Habits', emoji: '☕', hint: 'Routines, quirks, daily life' },
  { id: 'hypotheticals', label: 'What If', emoji: '🤔', hint: 'Would you rather, superpowers' },
  { id: 'family', label: 'Family', emoji: '👨‍👩‍👧‍👦', hint: 'Traditions, stories, inside jokes' },
  { id: 'entertainment', label: 'Entertainment', emoji: '🎬', hint: 'Movies, music, TV, books' },
  { id: 'experiences', label: 'Experiences', emoji: '🎯', hint: 'Firsts, bests, life moments' },
  { id: 'dreams', label: 'Dreams', emoji: '🚀', hint: 'Goals, bucket list, aspirations' },
  { id: 'misc', label: 'Surprise Me', emoji: '🎲', hint: 'Random fun question' },
];

// ---------------------------------------------------------------------------
// Load ALL previous shared questions (cached per invocation)
// ---------------------------------------------------------------------------

let cachedSharedQuestions: string[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 30_000;

async function getAllPreviousSharedQuestions(): Promise<string[]> {
  const now = Date.now();
  if (cachedSharedQuestions && (now - cacheTime) < CACHE_TTL) {
    return cachedSharedQuestions;
  }

  const keys = await listObjects('facts/daily/shared/');
  const questions: string[] = [];

  // Parallel read — fast
  const results = await Promise.all(
    keys.map(async (key) => {
      try {
        const data = await getJson<any>(key);
        return data?.question || null;
      } catch { return null; }
    }),
  );

  for (const q of results) {
    if (q) questions.push(q);
  }

  cachedSharedQuestions = questions;
  cacheTime = now;

  logger.info('Loaded all previous shared questions', { count: questions.length });
  return questions;
}

// ---------------------------------------------------------------------------
// Generate a unique daily fact question
// ---------------------------------------------------------------------------

export async function generateDailyFactQuestion(
  userId: string,
  userTheme?: string,
  categoryId?: string,
): Promise<DailyFactQuestion> {
  const todayDate = getEasternDateString();

  // Load ALL previous questions — not a sample
  const allPrevious = await getAllPreviousSharedQuestions();

  // Use selected category or pick random
  const catObj = FACT_CATEGORIES.find(c => c.id === categoryId)
    || FACT_CATEGORIES[Math.floor(Math.random() * (FACT_CATEGORIES.length - 1))]; // exclude 'misc' from random
  const category = catObj.label;

  // Build prompt with ALL previous questions included
  const previousList = allPrevious.length > 0
    ? allPrevious.map((q, i) => `${i + 1}. "${q}"`).join('\n')
    : 'None yet';

  const themeInstruction = userTheme
    ? `\nThe person who goes first today suggested this theme: "${userTheme}"\nIncorporate it creatively while keeping the question fun and universally answerable.`
    : '';

  const prompt = `Generate ONE fun question for a family daily fact game.
Category for today: ${category}${themeInstruction}

RULES:
- Short (max 20 words), clear, engaging
- Answerable by anyone in 1-2 sentences
- Light-hearted, non-controversial
- No role-play, no "imagine you are...", no "our family"
- Focus on personal preferences, experiences, or opinions
- Must be COMPLETELY DIFFERENT from all ${allPrevious.length} previously asked questions

PREVIOUSLY ASKED (DO NOT REPEAT OR REPHRASE ANY OF THESE):
${previousList}

Return ONLY the question text. No quotes, no prefix, no explanation.`;

  // Use Sonnet for quality
  const modelId = AVAILABLE_MODELS.CLAUDE_SONNET_4;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const temp = 0.8 + attempt * 0.1;
      const stream = await invokeBedrockPrompt(prompt, 128, temp, {}, modelId);
      const buf = await collectResponseBody(stream);
      const text = extractTextContent(buf, modelId, 'question');

      if (!text) continue;

      const cleaned = text.replace(/^["']|["']$/g, '').replace(/^Question:\s*/i, '').trim();

      if (cleaned.length < 10 || cleaned.length > 200) continue;

      // Check against ALL previous questions
      if (isDuplicateQuestionString(cleaned, allPrevious)) {
        logger.warn('Daily fact question is duplicate, retrying', {
          attempt: attempt + 1, question: cleaned.substring(0, 50),
        });
        continue;
      }

      logger.info('Generated unique daily fact question', {
        category, question: cleaned.substring(0, 60), attempt: attempt + 1,
        previousCount: allPrevious.length,
      });

      return {
        question: cleaned,
        category,
        timestamp: new Date().toISOString(),
        date: todayDate,
        questionType: 'shared',
        createdBy: userId,
        createdByFirstPerson: true,
        theme: userTheme,
      };
    } catch (err) {
      logger.error('Daily fact generation attempt failed', {
        attempt: attempt + 1,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Fallback — still better than repeating
  return {
    question: `What's something that made you smile this week?`,
    category: 'Life Experiences',
    timestamp: new Date().toISOString(),
    date: todayDate,
    questionType: 'shared',
    createdBy: userId,
    createdByFirstPerson: true,
    theme: userTheme,
  };
}

// ---------------------------------------------------------------------------
// Generate AI question options for FirstPerson flow
// ---------------------------------------------------------------------------

export async function generateQuestionOptions(
  userId: string,
  userTheme?: string,
): Promise<Array<{ question: string; category: string }>> {
  const allPrevious = await getAllPreviousSharedQuestions();

  const previousList = allPrevious.length > 0
    ? allPrevious.slice(-30).map(q => `- "${q}"`).join('\n')
    : 'None yet';

  const themeInstruction = userTheme
    ? `Theme suggested: "${userTheme}". Make the questions relate to this theme.`
    : '';

  const prompt = `Generate 3 fun question options for a family daily fact game.
${themeInstruction}

RULES:
- Each question max 20 words, clear, engaging
- Answerable by anyone in 1-2 sentences
- Light-hearted, non-controversial
- Each from a DIFFERENT category
- Must NOT repeat or closely match any previously asked question

RECENTLY ASKED (avoid similar):
${previousList}

Return ONLY a JSON array of 3 objects: [{"question": "...", "category": "..."}]
Categories: ${FACT_CATEGORIES.join(', ')}`;

  try {
    const modelId = AVAILABLE_MODELS.CLAUDE_SONNET_4;
    const stream = await invokeBedrockPrompt(prompt, 512, 0.9, {}, modelId);
    const buf = await collectResponseBody(stream);
    const text = (buf as any).rawText || JSON.stringify(buf);

    // Try to parse JSON from response
    const match = text.match(/\[[\s\S]*\]/);
    if (match) {
      const options = JSON.parse(match[0]);
      if (Array.isArray(options) && options.length >= 2) {
        // Filter out duplicates
        return options
          .filter((o: any) => o.question && !isDuplicateQuestionString(o.question, allPrevious))
          .slice(0, 3);
      }
    }
  } catch (err) {
    logger.error('Failed to generate question options', {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Fallback options
  return [
    { question: "What's a song that instantly takes you back to a specific memory?", category: 'Entertainment & Pop Culture' },
    { question: "What's the best meal you've ever had and where was it?", category: 'Food & Cooking' },
    { question: "What's one thing on your bucket list you haven't done yet?", category: 'Dreams & Aspirations' },
  ];
}

// ---------------------------------------------------------------------------
// Save/get today's shared question
// ---------------------------------------------------------------------------

export async function getTodaySharedQuestion(): Promise<DailyFactQuestion | null> {
  const todayDate = getEasternDateString();
  const key = S3_PATHS.GLOBAL_SHARED_QUESTION(todayDate);
  return getJson<DailyFactQuestion>(key);
}

export async function saveTodaySharedQuestion(question: DailyFactQuestion): Promise<boolean> {
  const key = S3_PATHS.GLOBAL_SHARED_QUESTION(question.date);
  return putJsonIfNotExists(key, question);
}

export function invalidateCache(): void {
  cachedSharedQuestions = null;
  cacheTime = 0;
}
