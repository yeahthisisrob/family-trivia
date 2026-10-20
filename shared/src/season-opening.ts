/**
 * The letter a season opens with when no one wrote one: a welcome, how last
 * season went, and what this one is, in a few lines, from the season's own
 * settings. An admin's own start letter replaces it (Admin › Seasons ›
 * Letters).
 */
import type { CircleKind } from './circle';
import { paceOf, perPeriod, type Season, type SeasonTrivia, seasonTriviaOf } from './season';
import { wordsFor } from './vocabulary';

/** People see it for this long after a season starts; later it would be old news. */
export const OPENING_DAYS = 14;

export interface OpeningFacts {
  kind: CircleKind;
  /** No season has ended here before this one. */
  first: boolean;
  /** How the last season went, when one ended. */
  last?: { name: string; people: number; answers: number };
}

/** Whether a season started recently enough (YYYY-MM-DD dates) for its opening letter. */
export function opensRecently(season: Pick<Season, 'startDate'>, today: string): boolean {
  const days = (Date.parse(today) - Date.parse(season.startDate)) / 86_400_000;
  return days >= 0 && days <= OPENING_DAYS;
}

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;

export function openingLetter(
  season: Pick<Season, 'name' | 'trivia' | 'play' | 'pace' | 'perWeek'>,
  facts: OpeningFacts,
): { title: string; markdown: string } {
  const words = wordsFor(facts.kind);
  const welcome = facts.first
    ? `Welcome to ${season.name}, the first season for ${words.circle}.`
    : `Welcome back. ${season.name} starts now.`;

  const last =
    facts.last && facts.last.answers > 0
      ? `In ${facts.last.name}, ${plural(facts.last.people, 'person', 'people')} shared ${plural(
          facts.last.answers,
          'answer',
        )} about ${facts.last.people === 1 ? 'themselves' : 'themselves and each other'}. Every one of them is still in Us › Look back.`
      : null;

  const trivia: Record<SeasonTrivia, string> = {
    general: '**Trivia** from the categories, about the world.',
    family: '**Trivia about us**, written from our own answers.',
    mixed: '**Trivia** from the categories, plus one about us.',
    off: '**No trivia this time:** just the questions about us.',
  };
  const weekly = paceOf(season) === 'weekly';
  const pace =
    weekly && seasonTriviaOf(season) !== 'off'
      ? `A new question about us each week, and ${plural(perPeriod(season), 'trivia question')} to play whenever suits you.`
      : `A new question about us ${weekly ? 'each week' : 'every day'}.`;
  const lines = [
    trivia[seasonTriviaOf(season)],
    pace,
    ...(season.play === 'teams'
      ? ['**Teams:** start one, or ask someone to team up, any time in the season.']
      : []),
    'Nothing expires. Play when you have time, and catch up on anything you missed.',
  ];

  return {
    title: `${season.name} begins`,
    markdown: [
      welcome,
      ...(last ? [last] : []),
      '**This season**',
      lines.map((l) => `- ${l}`).join('\n'),
      'See you on Home.',
    ].join('\n\n'),
  };
}
