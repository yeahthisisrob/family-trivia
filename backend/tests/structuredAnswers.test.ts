vi.mock('../services/s3', async () => (await import('./helpers/s3Mock')).s3MockModule);

import { isPersona } from '../features/knowledge/ai';
import { isPlan } from '../features/look-back/writing';
import { isDrops } from '../features/plans/ai';
import { isCluePairs } from '../routes/crossword';
import { wrongsProblem } from '../routes/familyFeud';
import { isThreeOptions } from '../routes/generateQuestionOptions';
import { setBedrockClient } from '../services/bedrock/core/converse';
import { isInsightList, usableInsights } from '../services/bedrock/members/memberSummary';
import {
  choiceQuestionProblem,
  isChoiceQuestion,
} from '../services/bedrock/questions/choiceQuestion';
import { isCategory } from '../services/bedrock/questions/customCategory';
import { factCheckQuestion, isFactCheck } from '../services/bedrock/questions/factChecker';
import { generateQuestionOptions, isQuestionOptions } from '../services/dailyFactService';
import { isSourcedQuestion } from '../services/familyTrivia';
import { curlingAI, getAIMove, isCurlingAnswer } from '../services/gameAI';
import { isQualityCheck } from '../services/questionPipeline';
import { calls, fakeBedrock, says } from './helpers/fakeBedrock';
import { resetS3Mock } from './helpers/s3Mock';

beforeEach(() => resetS3Mock());
afterEach(() => setBedrockClient(null));

const pie = {
  question: 'Which dessert did Carol bring to Springfield?',
  choices: ['Pie', 'Cake', 'Flan', 'Tart'],
  answer: 'Pie',
};

describe('the checks on structured answers (0033)', () => {
  test('a choice question: four filled choices, the answer one of them', () => {
    expect(isChoiceQuestion(pie)).toBe(true);
    expect(choiceQuestionProblem({ ...pie, choices: ['Pie', 'Cake', 'Flan'] })).toMatch(/four/);
    expect(choiceQuestionProblem({ ...pie, choices: ['Pie', 'Cake', 'Flan', ''] })).toMatch(/four/);
    expect(choiceQuestionProblem({ ...pie, answer: 'Mousse' })).toMatch(/one of the choices/);
    expect(choiceQuestionProblem({ ...pie, question: ' ' })).toMatch(/empty/);
    expect(isSourcedQuestion({ ...pie, source: 2 })).toBe(true);
    expect(isSourcedQuestion({ ...pie, source: 'two' })).toBe(false);
  });

  test('lists: an object holding a list of objects', () => {
    expect(isDrops({ drops: [] })).toBe(true);
    expect(isDrops({ drops: ['beach'] })).toBe(false);
    expect(isDrops([{ kind: 'busy' }])).toBe(false);
    expect(isInsightList({ insights: [{ text: 'Loves pie', category: 'preference' }] })).toBe(true);
    expect(
      usableInsights([
        { text: 'Loves pie', category: 'preference' },
        { text: '', category: 'fact' },
        { text: 'Tall', category: 'height' },
      ]),
    ).toEqual([{ text: 'Loves pie', category: 'preference' }]);
  });

  test('a persona needs words; traits are optional but must be strings', () => {
    expect(isPersona({ persona: 'Bob loves the lake.', traits: ['outdoorsy'] })).toBe(true);
    expect(isPersona({ persona: 'Bob loves the lake.' })).toBe(true);
    expect(isPersona({ persona: '', traits: [] })).toBe(false);
    expect(isPersona({ persona: 'Bob.', traits: [1] })).toBe(false);
  });

  test('a book plan: a foreword and a list of chapters', () => {
    expect(isPlan({ foreword: 'We kept coming back.', chapters: [] })).toBe(true);
    expect(isPlan({ foreword: '', chapters: [] })).toBe(false);
    expect(isPlan({ foreword: 'We.', chapters: 'none' })).toBe(false);
  });

  test('crossword pairs: at least three, each a clue and an answer', () => {
    const pair = { clue: "Alice's favorite color", answer: 'BLUE', difficulty: 'easy' };
    expect(isCluePairs({ pairs: [pair, pair, pair] })).toBe(true);
    expect(isCluePairs({ pairs: [pair, pair] })).toBe(false);
    expect(isCluePairs({ pairs: [pair, pair, { clue: 'x', answer: 7 }] })).toBe(false);
  });

  test('feud wrong answers: three, filled, none the real answer', () => {
    const wrongs = { wrong1: 'Spiders', wrong2: 'Heights', wrong3: 'Clowns' };
    expect(wrongsProblem(wrongs, 'The dark')).toBeNull();
    expect(wrongsProblem({ ...wrongs, wrong3: '' }, 'The dark')).toMatch(/filled/);
    expect(wrongsProblem({ ...wrongs, wrong2: ' the dark ' }, 'The dark')).toMatch(/real answer/);
  });

  test('question options: three (or at least two) with questions', () => {
    const o = { id: '1', question: 'What made you laugh this week?', theme: 'Playful You' };
    expect(isThreeOptions({ options: [o, o, o] })).toBe(true);
    expect(isThreeOptions({ options: [o, o] })).toBe(false);
    expect(isThreeOptions({ options: [o, o, { ...o, id: 3 }] })).toBe(false);
    const daily = { question: 'Best trip?', category: 'Travel' };
    expect(isQuestionOptions({ options: [daily, daily] })).toBe(true);
    expect(isQuestionOptions({ options: [daily] })).toBe(false);
    expect(isQuestionOptions({ options: [daily, { question: 'Best trip?' }] })).toBe(false);
  });

  test('verdicts: accuracy is a boolean, and the rest the right type', () => {
    expect(isQualityCheck({ isAccurate: true, difficultyOk: true })).toBe(true);
    expect(isQualityCheck({ isAccurate: false, correctAnswer: 'Cake' })).toBe(true);
    expect(isQualityCheck({ isAccurate: 'yes' })).toBe(false);
    expect(isQualityCheck({ isAccurate: false, correctAnswer: 3 })).toBe(false);
    expect(isFactCheck({ isAccurate: true, confidence: 'high' })).toBe(true);
    expect(isFactCheck({ isAccurate: true, confidence: 'very' })).toBe(false);
    expect(isFactCheck({ isAccurate: true, suggestedDifficulty: 'medium' })).toBe(false);
  });

  test('a category and a curling throw', () => {
    expect(isCategory({ title: 'Springfield', description: 'All about the town.' })).toBe(true);
    expect(isCategory({ title: 'Springfield' })).toBe(false);
    expect(isCurlingAnswer({ power: 60, angle: 0, strategy: 'draw' })).toBe(true);
    expect(isCurlingAnswer({ power: '60', angle: 0 })).toBe(false);
  });
});

describe('callers keep their fallbacks', () => {
  test("the model's three daily options come back, not the fallback", async () => {
    const options = [
      { question: 'What song takes you back to summer camp?', category: 'Memories' },
      { question: 'Where would you go for one perfect day?', category: 'Travel' },
      { question: 'What habit are you proudest of?', category: 'Habits' },
    ];
    fakeBedrock(calls('question_options', { options }));
    expect(await generateQuestionOptions()).toEqual(options);
  });

  test('a fact check that never takes shape lets the question through, unsure', async () => {
    fakeBedrock(says('Looks fine to me.'));
    expect(await factCheckQuestion({ ...pie, category: 'Food' } as never)).toMatchObject({
      isAccurate: true,
      confidence: 'low',
      explanation: 'Could not parse fact check response',
    });
  });

  test('a game move: the rules go in system, and a bad answer means the local fallback', async () => {
    const sent = fakeBedrock(calls('throw_stone', { power: 70, angle: 0.02, strategy: 'takeout' }));
    expect(await getAIMove(curlingAI, { stones: [], throwNum: 0 })).toEqual({
      power: 70,
      angle: 0.02,
      strategy: 'takeout',
    });
    expect(JSON.stringify(sent[0]?.system)).toContain('curling strategy AI');
    fakeBedrock(calls('throw_stone', { power: 'hard' }));
    expect(await getAIMove(curlingAI, { stones: [], throwNum: 1 })).toBeNull();
  });
});
