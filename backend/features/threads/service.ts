/**
 * Threads (docs/decisions/0022): one "How do you know ...?" a day, and the
 * answer ties a thread in the people model. Each person's answers live at
 * threads/{userId}.json; the ties they make live in family.json with every
 * other tie, saved the one versioned way.
 */
import {
  type Family,
  isPlaying,
  NOT_MET,
  relationOf,
  type ThreadAnswer,
  type ThreadProgress,
  type ThreadsToday,
  threadChoicesFor,
  threadPrompt,
  tieFromAnswer,
} from '@family-trivia/shared';
import { currentCircleKind } from '../../services/circles';
import { loadJoined } from '../../services/family/joined';
import { loadFamily, storeFamily } from '../../services/family/roster';
import { logger } from '../../services/logger';
import { getJson, putJson } from '../../services/s3';
import { currentPlayDay } from '../../services/seasonService';

interface Answered {
  choice: string;
  when?: string;
  at: string;
}

interface MyThreads {
  answers: Record<string, Answered>;
  /** The day (ET) of the last answer: one a day. */
  lastDay?: string;
}

const KEY = (userId: string) => `threads/${userId}.json`;
const load = async (userId: string): Promise<MyThreads> =>
  (await getJson<MyThreads>(KEY(userId))) ?? { answers: {} };

/** Everyone in the circle who could be asked about: joined, playing, still here. */
const peopleIn = (f: Family) => Object.values(f.people).filter(isPlaying);

function progressOf(f: Family): ThreadProgress {
  const ids = peopleIn(f).map((p) => p.id);
  let tied = 0;
  for (let i = 0; i < ids.length; i++)
    for (let j = i + 1; j < ids.length; j++) if (relationOf(f, ids[i], ids[j])) tied++;
  return { tied, pairs: (ids.length * (ids.length - 1)) / 2 };
}

/** Who to ask about: someone with no known connection to me that I haven't answered about. */
function nextAbout(f: Family, me: string, mine: MyThreads, today: string) {
  const open = peopleIn(f)
    .filter((p) => p.id !== me && !mine.answers[p.id] && !relationOf(f, me, p.id))
    .sort((a, b) => a.id.localeCompare(b.id));
  if (!open.length) return null;
  // A different person each day, the same one all day.
  const day = [...today].reduce((n, c) => n + c.charCodeAt(0), 0);
  return open[day % open.length];
}

export async function threadsToday(me: string): Promise<ThreadsToday> {
  const [{ visible }, kind, mine] = await Promise.all([
    loadJoined(),
    currentCircleKind(),
    load(me),
  ]);
  const today = await currentPlayDay(); // one thread a day, or a week in a weekly season
  const progress = progressOf(visible);
  if (mine.lastDay === today || !visible.people[me]) return { question: null, progress };
  const about = nextAbout(visible, me, mine, today);
  return {
    question: about && {
      about: { id: about.id, name: about.name },
      prompt: threadPrompt(kind, about.name),
      choices: threadChoicesFor(kind),
    },
    progress,
  };
}

export type AnswerResult =
  | { ok: true; tied: boolean; progress: ThreadProgress }
  | { ok: false; error: string };

export async function answerThread(me: string, a: ThreadAnswer): Promise<AnswerResult> {
  const [{ visible }, kind, mine] = await Promise.all([
    loadJoined(),
    currentCircleKind(),
    load(me),
  ]);
  if (a.about === me || !visible.people[a.about] || !visible.people[me])
    return { ok: false, error: "That person isn't in the circle" };
  if (!threadChoicesFor(kind).some((c) => c.id === a.choice))
    return { ok: false, error: 'Unknown answer' };

  const today = await currentPlayDay(); // one thread a day, or a week in a weekly season
  mine.answers[a.about] = {
    choice: a.choice,
    ...(a.when ? { when: a.when } : {}),
    at: new Date().toISOString(),
  };
  mine.lastDay = today;
  await putJson(KEY(me), mine);

  // The tie, unless they're already connected (the other one may have answered first).
  const family = await loadFamily();
  const tie =
    a.choice === NOT_MET || relationOf(family, me, a.about)
      ? null
      : tieFromAnswer(me, a, `th-${me}-${a.about}`);
  if (tie) {
    await storeFamily({ ...family, ties: [...family.ties, tie] }, me);
    logger.info('Thread tied', { type: tie.type });
  }
  const after = tie ? { ...visible, ties: [...visible.ties, tie] } : visible;
  return { ok: true, tied: !!tie, progress: progressOf(after) };
}
