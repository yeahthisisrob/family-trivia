/** Birthday entry */
export interface Birthday {
  userId: string;
  name: string;
  birthday: string;
  month: number;
  day: number;
  daysUntil: number;
  isToday: boolean;
  isPast: boolean;
  type?: 'birthday' | 'anniversary' | 'holiday' | 'other';
  description?: string;
  year?: number;
  celebrationId?: string;
  isFromFacts?: boolean;
  /** The person has died: the day is for remembering, not celebrating. */
  remembered?: boolean;
}

/** Upcoming birthdays response */
export interface UpcomingBirthdaysResponse {
  birthdays: Birthday[];
  todaysBirthdays: Birthday[];
}

/** Celebration entry */
export interface Celebration {
  id: string;
  type: 'birthday' | 'anniversary' | 'holiday' | 'other';
  name: string;
  date: string;
  description?: string;
  addedBy: string;
  addedAt: string;
  recurring: boolean;
  year?: number;
  addedByName?: string;
  isFromFacts?: boolean;
  isManual?: boolean;
  /** A birthday of someone the family remembers. */
  remembered?: boolean;
}

/** Celebrations response */
export interface CelebrationsResponse {
  celebrations: Celebration[];
  lastUpdated: string;
}

export type CelebrationType = Celebration['type'];
export const CELEBRATION_TYPES: readonly CelebrationType[] = [
  'birthday',
  'anniversary',
  'holiday',
  'other',
];

const MONTHS = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec',
] as const;
const DAYS_IN = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** A real day of the year (Feb 29 allowed). */
export const isMonthDay = (month: number, day: number): boolean =>
  Number.isInteger(month) &&
  Number.isInteger(day) &&
  month >= 1 &&
  month <= 12 &&
  day >= 1 &&
  day <= (DAYS_IN[month - 1] ?? 0);

/**
 * The month and day in however someone wrote their birthday: "07/24",
 * "7/24/1950", "0724", "July 24th 1950", "Jul 24", "1950-07-24". The year
 * comes back only when it was written in full. Null for anything else,
 * "Confidential" included.
 */
export function parseMonthDay(text: string | null | undefined): {
  month: number;
  day: number;
  year?: number;
} | null {
  const s = (text ?? '').trim().toLowerCase();
  if (!s) return null;
  const done = (month: number, day: number, year?: number) =>
    isMonthDay(month, day) ? { month, day, ...(year && year > 1900 ? { year } : {}) } : null;

  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return done(Number(iso[2]), Number(iso[3]), Number(iso[1]));

  const slash = s.match(/^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?\b/);
  if (slash) {
    const year = slash[3]?.length === 4 ? Number(slash[3]) : undefined;
    return done(Number(slash[1]), Number(slash[2]), year);
  }

  const packed = s.match(/^(\d{2})(\d{2})$/);
  if (packed) return done(Number(packed[1]), Number(packed[2]));

  const named = s.match(/\b([a-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b(?:,?\s+(\d{4}))?/);
  if (named) {
    const month = MONTHS.findIndex((m) => named[1]?.startsWith(m)) + 1;
    if (month) return done(month, Number(named[2]), named[3] ? Number(named[3]) : undefined);
  }
  return null;
}
