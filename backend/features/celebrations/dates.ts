/**
 * The family's dates: everyone's birthday and the celebrations people added.
 * A birthday comes from the people model when the family recorded one, or
 * else from the person's own answer to the birthday question. Only people
 * the family can see are included; remembered people keep their day.
 */
import { type Celebration, isRemembered, parseMonthDay } from '@family-trivia/shared';
import { getFactHistory } from '../../services/factHistoryService';
import { loadJoined } from '../../services/family/joined';
import { getJson, putJson } from '../../services/s3';

export const CELEBRATIONS_KEY = 'celebrations/celebrations.json';

export interface StoredCelebrations {
  celebrations: Celebration[];
  lastUpdated: string;
}

export interface PersonBirthday {
  personId: string;
  name: string;
  month: number;
  day: number;
  /** As they wrote it, or the recorded date. */
  raw: string;
  remembered: boolean;
  /** When they answered the question, if that's where it came from. */
  answeredAt?: string;
}

/** Basic question 0 asks for the birthday. */
const BIRTHDAY_QUESTION = 0;

export async function personBirthdays(): Promise<PersonBirthday[]> {
  const { visible } = await loadJoined();
  const found = await Promise.all(
    Object.values(visible.people).map(async (p) => {
      const base = { personId: p.id, name: p.name, remembered: isRemembered(p) };
      const recorded = parseMonthDay(p.born?.date);
      if (recorded && p.born?.date) return { ...base, ...pick(recorded), raw: p.born.date };
      const answer = (await getFactHistory(p.id)).find(
        (e) => e.questionType === 'basic' && e.questionIndex === BIRTHDAY_QUESTION && e.answered,
      );
      const parsed = parseMonthDay(answer?.answer);
      return parsed && answer
        ? { ...base, ...pick(parsed), raw: answer.answer, answeredAt: answer.timestamp }
        : null;
    }),
  );
  return found.filter((b): b is PersonBirthday => b !== null);
}

const pick = ({ month, day }: { month: number; day: number }) => ({ month, day });

export async function readCelebrations(): Promise<StoredCelebrations> {
  return (
    (await getJson<StoredCelebrations>(CELEBRATIONS_KEY)) ?? {
      celebrations: [],
      lastUpdated: new Date().toISOString(),
    }
  );
}

export async function writeCelebrations(celebrations: Celebration[]): Promise<void> {
  await putJson(CELEBRATIONS_KEY, { celebrations, lastUpdated: new Date().toISOString() });
}

/** "MM/DD", the stored form. */
export const mmdd = (month: number, day: number) =>
  `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}`;
