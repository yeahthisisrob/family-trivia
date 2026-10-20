vi.mock('../services/s3', async () => (await import('./helpers/s3Mock')).s3MockModule);

import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { APIGatewayProxyEvent } from 'aws-lambda';
import { getClues, getSave, getScores, postScore, putSave } from '../features/games/handlers';
import { defineServerGame, routesOf } from '../features/games/kit';
import { GAME_FOLDERS } from '../features/games/routes';
import { serverGames } from '../services/gameRegistry';
import { resetS3Mock, seedRaw } from './helpers/s3Mock';

const ev = (q: Record<string, string> = {}, body?: unknown) =>
  ({
    queryStringParameters: q,
    body: body === undefined ? null : JSON.stringify(body),
  }) as unknown as APIGatewayProxyEvent;
const json = (r: { body: string }) => JSON.parse(r.body).data;

beforeEach(() => resetS3Mock());

describe('games: any game by id (0032)', () => {
  it('keeps a scoreboard for a game nobody registered', async () => {
    await postScore(ev({}, { game: 'word-ladder', score: 40 }), 'alice');
    await postScore(ev({}, { game: 'word-ladder', score: 90 }), 'bob');
    const r = await postScore(ev({}, { game: 'word-ladder', score: 20 }), 'alice');
    expect(json(r).isNewHighScore).toBe(false);
    const board = json(await getScores(ev({ game: 'word-ladder' })));
    expect(board.scores.map((s: { userId: string }) => s.userId)).toEqual(['bob', 'alice']);
  });

  it('turns away ids that are not a folder name, and bad scores', async () => {
    for (const game of ['../family', 'Snake', 'a', 'x'.repeat(40)])
      expect((await getScores(ev({ game }))).statusCode).toBe(400);
    expect((await postScore(ev({}, { game: 'snake', score: -1 }), 'alice')).statusCode).toBe(400);
  });

  it('keeps a small save per player', async () => {
    expect(json(await getSave(ev({ game: 'snake' }), 'alice')).save).toBeNull();
    await putSave(ev({}, { game: 'snake', save: { level: 3 } }), 'alice');
    expect(json(await getSave(ev({ game: 'snake' }), 'alice')).save).toEqual({ level: 3 });
    expect(json(await getSave(ev({ game: 'snake' }), 'bob')).save).toBeNull();
    const big = await putSave(ev({}, { game: 'snake', save: 'x'.repeat(20_000) }), 'alice');
    expect(big.statusCode).toBe(413);
  });

  it('makes clues from trivia and answers, within the lengths asked', async () => {
    seedRaw('family/family.json', {
      version: 2,
      name: 'The Crew',
      people: { bob: { id: 'bob', name: 'Bob', participation: 'playing' } },
      ties: [],
      households: {},
    });
    seedRaw('facts/answers/bob.json', [
      { question: 'Favorite food?', answer: 'Tacos, always', answered: true, date: '2026-10-01' },
    ]);
    const { clues } = json(await getClues(ev({ minLength: '4', maxLength: '6' })));
    expect(clues).toContainEqual({
      clue: 'Bob: Favorite food?',
      answer: 'TACOS',
      from: 'answers',
      about: 'bob',
    });
    for (const c of clues) expect(c.answer.length).toBeGreaterThanOrEqual(4);
  });
});

describe('game server folders (0032)', () => {
  it('registers every folder under features/games, its id the folder name', () => {
    const dir = join(import.meta.dirname, '../features/games');
    const folders = readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && existsSync(join(dir, e.name, 'index.ts')))
      .map((e) => e.name)
      .sort();
    expect(GAME_FOLDERS.map((g) => g.id).sort()).toEqual(folders);
    expect(serverGames().map((g) => g.id)).toEqual(GAME_FOLDERS.map((g) => g.id));
  });

  it('serves each folder route at /<id>/<action>', () => {
    const fn = async () => ({ statusCode: 200, body: '' });
    const game = defineServerGame({
      id: 'word-ladder',
      label: 'Word Ladder',
      routes: { 'POST climb': fn },
    });
    expect(Object.keys(routesOf(game))).toEqual(['POST /word-ladder/climb']);
  });
});
