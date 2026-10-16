/**
 * A season's review (shared/src/look-back.ts), read from everyone's answers,
 * trivia, comments and reactions inside the season's dates. Only people the
 * family can see are in it, remembered people included.
 */
import {
  type BookPage,
  type FactAnswerEntry,
  type HistoryEntry,
  LOVED,
  type Season,
  type SeasonReview,
  TOGETHER,
  wordsIn,
} from '@family-trivia/shared';
import { S3_PATHS } from '../../constants';
import { getFactHistory } from '../../services/factHistoryService';
import { loadJoined } from '../../services/family/joined';
import { getJson, listObjects } from '../../services/s3';
import { computePoints } from '../../services/scoring';

const real = (e: FactAnswerEntry) => e.answered && !e.skipped && !!e.answer?.trim();
const dayOf = (iso: string) => iso.slice(0, 10);
/** Ids with a stored file under a prefix: comments/fact/{id}.json, reactions/fact/{id}.json. */
const idsUnder = async (prefix: string) =>
  (await listObjects(prefix)).map((k) => k.slice(prefix.length, -'.json'.length));

export async function buildSeasonReview(season: Season, all: Season[]): Promise<SeasonReview> {
  const from = season.startDate;
  const to = season.endDate ?? '9999-12-31';
  const inSeason = (d: string) => d >= from && d <= to;

  const { visible } = await loadJoined();
  const ids = Object.keys(visible.people);
  const [facts, trivia, commented, reacted] = await Promise.all([
    Promise.all(ids.map((id) => getFactHistory(id))),
    Promise.all(
      ids.map(async (id) => (await getJson<HistoryEntry[]>(S3_PATHS.ANSWER_HISTORY(id))) ?? []),
    ),
    idsUnder('comments/fact/'),
    idsUnder('reactions/fact/'),
  ]);

  const answers = ids.flatMap((personId, i) =>
    (facts[i] ?? [])
      .filter((e) => real(e) && e.timestamp && inSeason(dayOf(e.timestamp)))
      .map((e) => ({ personId, entry: e, id: `${personId}_${e.timestamp}` })),
  );
  const ours = new Set(answers.map((a) => a.id));

  const [comments, reactions] = await Promise.all([
    Promise.all(
      commented
        .filter((id) => ours.has(id))
        .map(async (id) => {
          const t = await getJson<{ comments?: unknown[] }>(`comments/fact/${id}.json`);
          return [id, t?.comments?.length ?? 0] as const;
        }),
    ).then((pairs) => new Map(pairs)),
    Promise.all(
      reacted
        .filter((id) => ours.has(id))
        .map(async (id) => {
          const r = await getJson<{ byUser?: Record<string, unknown> }>(
            `reactions/fact/${id}.json`,
          );
          return [id, Object.keys(r?.byUser ?? {}).length] as const;
        }),
    ).then((pairs) => new Map(pairs)),
  ]);

  // The day's shared question, everyone's answer to it.
  const pages = new Map<string, BookPage>();
  for (const a of answers) {
    if (a.entry.questionType !== 'shared') continue;
    const date = a.entry.date || dayOf(a.entry.timestamp);
    const key = `${date}|${a.entry.question}`;
    const page = pages.get(key) ?? { date, question: a.entry.question, answers: [] };
    page.answers.push({ personId: a.personId, answer: a.entry.answer.trim() });
    pages.set(key, page);
  }
  const book = [...pages.values()].sort((a, b) => a.date.localeCompare(b.date));

  const triviaIn = trivia.map((h) => h.filter((t) => t.timestamp && inSeason(dayOf(t.timestamp))));
  const people = ids
    .map((personId, i) => {
      const mine = answers.filter((a) => a.personId === personId);
      const played = triviaIn[i] ?? [];
      return {
        personId,
        answers: mine.length,
        words: mine.reduce((n, a) => n + wordsIn(a.entry.answer), 0),
        trivia: played.length,
        right: played.filter((t) => t.correct).length,
        points: played.reduce((n, t) => n + (t.correct ? computePoints(t) : 0), 0),
      };
    })
    .filter((p) => p.answers + p.trivia > 0)
    .sort((a, b) => b.answers - a.answers || b.trivia - a.trivia);

  const loved = answers
    .map((a) => ({
      id: a.id,
      personId: a.personId,
      question: a.entry.question,
      answer: a.entry.answer.trim(),
      reactions: reactions.get(a.id) ?? 0,
      comments: comments.get(a.id) ?? 0,
    }))
    .filter((l) => l.reactions + l.comments > 0)
    .sort((a, b) => b.reactions + b.comments - (a.reactions + a.comments))
    .slice(0, LOVED);

  const together = [...book]
    .sort((a, b) => b.answers.length - a.answers.length || a.date.localeCompare(b.date))
    .slice(0, TOGETHER);

  return {
    season: {
      number: season.seasonNumber,
      name: season.name,
      startDate: season.startDate,
      endDate: season.endDate,
    },
    seasons: [...all]
      .sort((a, b) => b.seasonNumber - a.seasonNumber)
      .map((s) => ({ number: s.seasonNumber, name: s.name })),
    numbers: {
      people: people.length,
      answers: answers.length,
      words: people.reduce((n, p) => n + p.words, 0),
      trivia: triviaIn.reduce((n, h) => n + h.length, 0),
      comments: [...comments.values()].reduce((n, c) => n + c, 0),
      reactions: [...reactions.values()].reduce((n, c) => n + c, 0),
      days: new Set(answers.map((a) => dayOf(a.entry.timestamp))).size,
    },
    together,
    loved,
    people,
    book,
  };
}
