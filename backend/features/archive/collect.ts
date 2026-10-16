/**
 * Gather one person's memories from storage: trivia answers, family facts,
 * games, comments and Family Feud rounds. Read-only; nothing is changed.
 */
import { ownerOf, type ReactionId, type ReactionRecord } from '@family-trivia/shared';
import { getJson, listObjects } from '../../services/s3';

interface HistoryEntry {
  question?: { question?: string; category?: string; difficulty?: string; answer?: string };
  selectedAnswer?: string;
  correct?: boolean;
  timestamp?: string;
  pointsEarned?: number;
}
interface FactEntry {
  date?: string;
  question?: string;
  answer?: string;
  fact?: string;
  answered?: boolean;
  skipped?: boolean;
  timestamp?: string;
}
interface CommentFile {
  contentType?: string;
  contentId?: string;
  comments?: { id: string; userId: string; text: string; timestamp: string }[];
}
interface FeudRound {
  roundId?: string;
  targetUserId?: string;
  question?: string;
  realAnswer?: string;
  guesses?: Record<string, unknown>;
  startedAt?: string;
}
interface ArcadeScore {
  userId: string;
  score: number;
  date: string;
  mode?: string;
}

export interface PersonArchive {
  trivia: HistoryEntry[];
  facts: FactEntry[];
  games: {
    casinoRush: unknown[];
    slotMachine: unknown[];
    arcade: (ArcadeScore & { game: string })[];
  };
  comments: { on: string; text: string; at: string }[];
  /** Reactions they gave, and the ones others gave to their answers and facts. */
  reactions: {
    given: { on: string; reaction: ReactionId; at: string }[];
    received: { on: string; from: string; reaction: ReactionId; at: string }[];
  };
  feud: { asTarget: FeudRound[]; guessed: FeudRound[] };
}

const list = async (prefix: string) =>
  (await listObjects(prefix)).filter((k) => k.endsWith('.json'));
const readAll = async <T>(keys: string[]): Promise<T[]> => {
  const all = await Promise.all(keys.map((k) => getJson<T>(k)));
  return all.filter((x): x is NonNullable<typeof x> => x != null) as T[];
};

/** Shared reads (comments, arcade, feud) done once for everyone being exported. */
export async function loadShared() {
  const [commentFiles, arcadeKeys, feudRounds, reactions] = await Promise.all([
    list('comments/').then((k) => readAll<CommentFile>(k)),
    list('arcade/scores/'),
    list('family-feud/rounds/').then((k) => readAll<FeudRound>(k)),
    Promise.all(
      (['fact', 'trivia'] as const).map(async (type) =>
        Promise.all(
          (await list(`reactions/${type}/`)).map(async (k) => ({
            on: `${type} ${k.split('/').pop()?.replace('.json', '')}`,
            record: (await getJson<ReactionRecord>(k)) ?? { byUser: {} },
          })),
        ),
      ),
    ).then((byType) => byType.flat()),
  ]);
  const arcade = (
    await Promise.all(
      arcadeKeys.map(async (k) => ({
        game: k.split('/').pop()?.replace('.json', '') ?? 'game',
        scores: (await getJson<ArcadeScore[]>(k)) ?? [],
      })),
    )
  ).flatMap(({ game, scores }) =>
    Array.isArray(scores) ? scores.map((s) => ({ ...s, game })) : [],
  );
  return { commentFiles, arcade, feudRounds, reactions };
}

export async function collectPerson(
  id: string,
  shared: Awaited<ReturnType<typeof loadShared>>,
): Promise<PersonArchive> {
  const [history, facts, casinoRush, slotMachine] = await Promise.all([
    getJson<HistoryEntry[]>(`answers/history/${id}.json`),
    getJson<FactEntry[]>(`facts/answers/${id}.json`),
    list(`casino-rush/${id}/`).then((k) => readAll<unknown>(k)),
    list(`slot-machine/${id}/`).then((k) => readAll<unknown>(k)),
  ]);
  return {
    trivia: Array.isArray(history) ? history : [],
    facts: (Array.isArray(facts) ? facts : []).filter(
      (f) => f.answered !== false && !f.skipped && f.answer,
    ),
    games: { casinoRush, slotMachine, arcade: shared.arcade.filter((s) => s.userId === id) },
    comments: shared.commentFiles.flatMap((file) =>
      (file.comments ?? [])
        .filter((c) => c.userId === id)
        .map((c) => ({
          on: `${file.contentType ?? 'post'} ${file.contentId ?? ''}`.trim(),
          text: c.text,
          at: c.timestamp,
        })),
    ),
    reactions: {
      given: shared.reactions.flatMap(({ on, record }) => {
        const r = record.byUser[id];
        return r ? [{ on, reaction: r.reaction, at: r.at }] : [];
      }),
      received: shared.reactions
        .filter(({ on }) => ownerOf(on.split(' ')[1] ?? '') === id)
        .flatMap(({ on, record }) =>
          Object.entries(record.byUser).map(([from, r]) => ({
            on,
            from,
            reaction: r.reaction,
            at: r.at,
          })),
        ),
    },
    feud: {
      asTarget: shared.feudRounds.filter((r) => r.targetUserId === id),
      guessed: shared.feudRounds.filter((r) => r.guesses && id in r.guesses),
    },
  };
}
