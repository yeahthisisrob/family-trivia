// File: lambda/services/triviaBankService.ts
// Purpose: Trivia bank management — stats, import from external APIs,
// AI-generated local categories, question browsing, dedup tracking.

import { getJson, putJson, listObjects } from './s3';
import { logger } from './logger';
import { AVAILABLE_MODELS } from '../config';
import { invokeBedrockPrompt } from './bedrock/core/bedrockClient';
import { collectResponseBody, extractJsonFromResponse } from './bedrock/core/responseParser';
import { getAllQuestionsFlat } from './questionHistoryService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BankQuestion {
  question: string;
  choices: string[];
  answer: string;
  category: string;
  difficulty: string;
  source: string;
  sourceUrl?: string;
  externalId?: string;
}

export interface BankFile {
  timestamp: string;
  count: number;
  questions: BankQuestion[];
}

export interface BankStats {
  totalQuestions: number;
  categories: Array<{
    category: string;
    count: number;
    difficulties: { easy: number; normal: number; hard: number };
  }>;
  sources: Array<[string, number]>;
  questionsAsked: number;
}

export interface ImportResult {
  source: string;
  category: string;
  difficulty: string;
  fetched: number;
  added: number;
  duplicates: number;
  errors: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BUCKET_CATEGORIES = [
  'Fun Facts & Oddities', 'Pop Culture', 'Science & Nature',
  'History & Politics', 'Geography & Travel', 'Literature & Arts',
  'Sports & Games', 'Food & Drink', 'Family Histories',
  'Rochester, NY', 'Brooklyn, NY', 'Capital Region, NY',
];

const DIFFICULTIES = ['easy', 'normal', 'hard'] as const;

function sanitizeCategory(cat: string): string {
  return cat.replace(/[^a-zA-Z0-9]/g, '_');
}

// ---------------------------------------------------------------------------
// Bank Stats
// ---------------------------------------------------------------------------

export async function getBankStats(): Promise<BankStats> {
  const categories: BankStats['categories'] = [];
  let total = 0;
  const sourceCounts: Record<string, number> = {};

  for (const cat of BUCKET_CATEGORIES) {
    const diffs = { easy: 0, normal: 0, hard: 0 };
    for (const diff of DIFFICULTIES) {
      try {
        const bank = await getJson<BankFile>(`trivia-bank/${sanitizeCategory(cat)}/${diff}.json`);
        if (bank) {
          diffs[diff] = bank.count;
          total += bank.count;
          for (const q of bank.questions) {
            sourceCounts[q.source] = (sourceCounts[q.source] || 0) + 1;
          }
        }
      } catch { /* category/difficulty may not exist */ }
    }
    if (diffs.easy + diffs.normal + diffs.hard > 0) {
      categories.push({
        category: cat,
        count: diffs.easy + diffs.normal + diffs.hard,
        difficulties: diffs,
      });
    }
  }

  // Count asked questions
  let questionsAsked = 0;
  try {
    const asked = await getAllQuestionsFlat(10000);
    questionsAsked = asked.length;
  } catch { /* ok */ }

  return {
    totalQuestions: total,
    categories,
    sources: Object.entries(sourceCounts),
    questionsAsked,
  };
}

// ---------------------------------------------------------------------------
// Browse Questions
// ---------------------------------------------------------------------------

export async function browseQuestions(
  category: string,
  difficulty: string,
  offset = 0,
  limit = 20,
): Promise<{ questions: BankQuestion[]; total: number }> {
  try {
    const bank = await getJson<BankFile>(`trivia-bank/${sanitizeCategory(category)}/${difficulty}.json`);
    if (!bank) return { questions: [], total: 0 };
    return {
      questions: bank.questions.slice(offset, offset + limit),
      total: bank.count,
    };
  } catch {
    return { questions: [], total: 0 };
  }
}

// ---------------------------------------------------------------------------
// Delete Question
// ---------------------------------------------------------------------------

export async function deleteQuestion(
  category: string,
  difficulty: string,
  questionText: string,
): Promise<boolean> {
  const key = `trivia-bank/${sanitizeCategory(category)}/${difficulty}.json`;
  try {
    const bank = await getJson<BankFile>(key);
    if (!bank) return false;
    const before = bank.questions.length;
    bank.questions = bank.questions.filter(q => q.question !== questionText);
    bank.count = bank.questions.length;
    if (bank.questions.length < before) {
      await putJson(key, bank);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Import from OpenTDB
// ---------------------------------------------------------------------------

const OPENTDB_CATEGORY_MAP: Record<number, string> = {
  9: 'Fun Facts & Oddities', 10: 'Literature & Arts', 11: 'Pop Culture',
  12: 'Pop Culture', 14: 'Pop Culture', 15: 'Pop Culture',
  17: 'Science & Nature', 18: 'Science & Nature', 20: 'Fun Facts & Oddities',
  21: 'Sports & Games', 22: 'Geography & Travel', 23: 'History & Politics',
  24: 'History & Politics', 25: 'Literature & Arts', 27: 'Fun Facts & Oddities',
};

function decodeHtml(html: string): string {
  return html.replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"').replace(/&lsquo;/g, "'").replace(/&rsquo;/g, "'")
    .replace(/&hellip;/g, '...').replace(/&eacute;/g, 'é').replace(/&ntilde;/g, 'ñ');
}

export async function importFromOpenTDB(
  targetCategory: string,
  difficulty: 'easy' | 'normal' | 'hard',
  count = 50,
): Promise<ImportResult> {
  const result: ImportResult = {
    source: 'OpenTDB', category: targetCategory, difficulty,
    fetched: 0, added: 0, duplicates: 0, errors: 0,
  };

  // Find OpenTDB category IDs that map to our category
  const catIds = Object.entries(OPENTDB_CATEGORY_MAP)
    .filter(([, cat]) => cat === targetCategory)
    .map(([id]) => parseInt(id));

  if (catIds.length === 0) {
    logger.warn('No OpenTDB mapping for category', { targetCategory });
    return result;
  }

  const otdbDiff = difficulty === 'normal' ? 'medium' : difficulty;

  // Load existing bank
  const key = `trivia-bank/${sanitizeCategory(targetCategory)}/${difficulty}.json`;
  let bank: BankFile;
  try {
    bank = await getJson<BankFile>(key) || { timestamp: '', count: 0, questions: [] };
  } catch {
    bank = { timestamp: '', count: 0, questions: [] };
  }

  const existingSet = new Set(bank.questions.map(q => q.question.toLowerCase().trim()));

  // Fetch from each matching OpenTDB category
  for (const catId of catIds) {
    try {
      const perCat = Math.ceil(count / catIds.length);
      const url = `https://opentdb.com/api.php?amount=${perCat}&category=${catId}&difficulty=${otdbDiff}&type=multiple`;
      const response = await fetch(url);
      const data = await response.json() as { response_code: number; results?: any[] };

      if (data.response_code !== 0 || !data.results) continue;
      result.fetched += data.results.length;

      for (const raw of data.results) {
        if (raw.type !== 'multiple') continue;
        const question = decodeHtml(raw.question);
        const answer = decodeHtml(raw.correct_answer);
        const incorrects = raw.incorrect_answers.map(decodeHtml);

        if (existingSet.has(question.toLowerCase().trim())) {
          result.duplicates++;
          continue;
        }
        if (incorrects.length !== 3) { result.errors++; continue; }

        const choices = [...incorrects, answer];
        for (let i = choices.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [choices[i], choices[j]] = [choices[j], choices[i]];
        }

        bank.questions.push({
          question, choices, answer,
          category: targetCategory, difficulty,
          source: 'OpenTDB', sourceUrl: 'https://opentdb.com',
          externalId: `opentdb_${catId}_${bank.questions.length}`,
        });
        existingSet.add(question.toLowerCase().trim());
        result.added++;
      }

      // Rate limit
      await new Promise(r => setTimeout(r, 5500));
    } catch (err) {
      logger.error('OpenTDB fetch error', { catId, error: err });
      result.errors++;
    }
  }

  bank.count = bank.questions.length;
  bank.timestamp = new Date().toISOString().split('T')[0];
  await putJson(key, bank);

  logger.info('OpenTDB import complete', { result });
  return result;
}

// ---------------------------------------------------------------------------
// Import from jService (Jeopardy)
// ---------------------------------------------------------------------------

export async function importFromJService(
  targetCategory: string,
  difficulty: 'easy' | 'normal' | 'hard',
  count = 50,
): Promise<ImportResult> {
  const result: ImportResult = {
    source: 'jService', category: targetCategory, difficulty,
    fetched: 0, added: 0, duplicates: 0, errors: 0,
  };

  const key = `trivia-bank/${sanitizeCategory(targetCategory)}/${difficulty}.json`;
  let bank: BankFile;
  try {
    bank = await getJson<BankFile>(key) || { timestamp: '', count: 0, questions: [] };
  } catch {
    bank = { timestamp: '', count: 0, questions: [] };
  }

  const existingSet = new Set(bank.questions.map(q => q.question.toLowerCase().trim()));

  try {
    // jService returns random clues
    const url = `https://jservice.io/api/random?count=${count}`;
    const response = await fetch(url);
    const clues = await response.json() as any[];
    result.fetched = clues.length;

    for (const clue of clues) {
      if (!clue.question || !clue.answer || clue.question.length < 10) continue;
      const question = clue.question.replace(/<[^>]*>/g, '').trim();
      const answer = clue.answer.replace(/<[^>]*>/g, '').trim();

      if (existingSet.has(question.toLowerCase().trim())) {
        result.duplicates++;
        continue;
      }

      // jService doesn't have multiple choice — we'll generate choices with AI later
      // For now, store as-is and mark for AI enhancement
      bank.questions.push({
        question, choices: [answer], answer,
        category: targetCategory, difficulty,
        source: 'jService', sourceUrl: 'https://jservice.io',
        externalId: `jservice_${clue.id}`,
      });
      existingSet.add(question.toLowerCase().trim());
      result.added++;
    }
  } catch (err) {
    logger.error('jService fetch error', { error: err });
    result.errors++;
  }

  bank.count = bank.questions.length;
  bank.timestamp = new Date().toISOString().split('T')[0];
  await putJson(key, bank);

  logger.info('jService import complete', { result });
  return result;
}

// ---------------------------------------------------------------------------
// AI-Generated Local Categories (Rochester, Brooklyn)
// ---------------------------------------------------------------------------

export async function generateLocalTrivia(
  category: string,
  difficulty: 'easy' | 'normal' | 'hard',
  count = 20,
): Promise<ImportResult> {
  const result: ImportResult = {
    source: 'AI-Generated', category, difficulty,
    fetched: 0, added: 0, duplicates: 0, errors: 0,
  };

  const key = `trivia-bank/${sanitizeCategory(category)}/${difficulty}.json`;
  let bank: BankFile;
  try {
    bank = await getJson<BankFile>(key) || { timestamp: '', count: 0, questions: [] };
  } catch {
    bank = { timestamp: '', count: 0, questions: [] };
  }

  const existingQuestions = bank.questions.map(q => `- "${q.question}"`).join('\n');

  const diffDesc: Record<string, string> = {
    easy: 'Common knowledge that locals and visitors would know',
    normal: 'Requires some familiarity with the area',
    hard: 'Deep local knowledge, history buffs, long-time residents',
  };

  const prompt = `Generate ${count} multiple-choice trivia questions about ${category}.
Difficulty: ${difficulty} — ${diffDesc[difficulty]}

Each question must have exactly 4 choices with 1 correct answer.
Questions should cover: landmarks, history, food, culture, notable people,
neighborhoods, events, sports, local traditions, geography.

${existingQuestions ? `AVOID repeating these existing questions:\n${existingQuestions}\n` : ''}

Return a JSON array of objects:
[{"question": "...", "choices": ["A", "B", "C", "D"], "answer": "correct choice"}]

Return ONLY the JSON array.`;

  try {
    const modelId = AVAILABLE_MODELS.CLAUDE_SONNET_4;
    const stream = await invokeBedrockPrompt(prompt, 4096, 0.8, {}, modelId);
    const buf = await collectResponseBody(stream);
    const parsed = extractJsonFromResponse(buf, modelId);

    let questions: any[] = [];
    if (Array.isArray(parsed)) {
      questions = parsed;
    } else if (parsed.rawText) {
      const match = parsed.rawText.match(/\[[\s\S]*\]/);
      if (match) questions = JSON.parse(match[0]);
    }

    result.fetched = questions.length;
    const existingSet = new Set(bank.questions.map(q => q.question.toLowerCase().trim()));

    for (const q of questions) {
      if (!q.question || !Array.isArray(q.choices) || q.choices.length !== 4 || !q.answer) {
        result.errors++;
        continue;
      }
      if (!q.choices.includes(q.answer)) { result.errors++; continue; }
      if (existingSet.has(q.question.toLowerCase().trim())) {
        result.duplicates++;
        continue;
      }

      bank.questions.push({
        question: q.question, choices: q.choices, answer: q.answer,
        category, difficulty,
        source: 'AI-Generated', sourceUrl: 'Claude Sonnet 4',
        externalId: `ai_${sanitizeCategory(category)}_${bank.questions.length}`,
      });
      existingSet.add(q.question.toLowerCase().trim());
      result.added++;
    }
  } catch (err) {
    logger.error('AI generation error', { category, error: err });
    result.errors++;
  }

  bank.count = bank.questions.length;
  bank.timestamp = new Date().toISOString().split('T')[0];
  await putJson(key, bank);

  logger.info('AI local trivia generation complete', { result });
  return result;
}

// ---------------------------------------------------------------------------
// Update Metadata
// ---------------------------------------------------------------------------

export async function updateMetadata(): Promise<BankStats> {
  const stats = await getBankStats();
  await putJson('trivia-bank/metadata.json', {
    timestamp: new Date().toISOString().split('T')[0],
    totalQuestions: stats.totalQuestions,
    categories: stats.categories,
    sources: stats.sources,
  });
  return stats;
}
