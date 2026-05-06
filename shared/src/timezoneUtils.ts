/**
 * Eastern Time utilities — single source of truth for frontend + backend.
 *
 * All date math that depends on "what day is it?" must use ET, because
 * daily questions and trivia are scoped to ET days, not UTC days.
 *
 * The game runs on America/New_York time (handles EST/EDT automatically).
 */

/**
 * Convert a date to an ET-shifted Date.
 *
 * Note: the returned Date's internal UTC value is shifted to ET, so use it
 * ONLY for extracting year/month/day/hour — not for ISO strings or comparisons
 * against other UTC dates.
 */
export function convertToEasternTime(date: Date = new Date()): Date {
  return new Date(date.toLocaleString('en-US', { timeZone: 'America/New_York' }));
}

/** Get today's date in Eastern Time as YYYY-MM-DD. */
export function getEasternDateString(date: Date = new Date()): string {
  const et = convertToEasternTime(date);
  const y = et.getFullYear();
  const m = String(et.getMonth() + 1).padStart(2, '0');
  const d = String(et.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Alias for getEasternDateString() — reads more naturally in UI code. */
export function getTodayET(): string {
  return getEasternDateString();
}

/** Get the current year in Eastern Time. */
export function getCurrentYearET(): number {
  return convertToEasternTime().getFullYear();
}

/** Get the current month (1-12) in Eastern Time. */
export function getCurrentMonthET(): number {
  return convertToEasternTime().getMonth() + 1;
}

/** Get the current day of month in Eastern Time. */
export function getCurrentDayET(): number {
  return convertToEasternTime().getDate();
}

/** Check if a given month/day matches today in Eastern Time. */
export function isTodayET(month: number, day: number): boolean {
  return getCurrentMonthET() === month && getCurrentDayET() === day;
}

/** Days from today until a specific month/day in Eastern Time. */
export function getDaysUntilET(targetMonth: number, targetDay: number): number {
  const currentYear = getCurrentYearET();
  const currentMonth = getCurrentMonthET();
  const currentDay = getCurrentDayET();

  let targetDate = new Date(currentYear, targetMonth - 1, targetDay);
  const todayDate = new Date(currentYear, currentMonth - 1, currentDay);

  if (targetDate < todayDate) {
    targetDate = new Date(currentYear + 1, targetMonth - 1, targetDay);
  }

  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.ceil((targetDate.getTime() - todayDate.getTime()) / msPerDay);
}

/**
 * Get the next midnight in Eastern Time, returned as a UTC ISO string.
 * Used for telling users when their next question is available.
 */
export function getNextMidnightET(now: Date = new Date()): string {
  const easternTime = convertToEasternTime(now);
  const nextMidnightET = new Date(easternTime);
  nextMidnightET.setHours(24, 0, 0, 0);

  // Convert back to UTC
  const etOffset = now.getTime() - easternTime.getTime();
  const nextMidnightUTC = new Date(nextMidnightET.getTime() + etOffset);

  return nextMidnightUTC.toISOString();
}

/** Seconds elapsed in the current day in Eastern Time. */
export function getSecondsElapsedTodayET(): number {
  const nowET = convertToEasternTime();
  return nowET.getHours() * 3600 + nowET.getMinutes() * 60 + nowET.getSeconds();
}

/** Seconds remaining until midnight Eastern Time. */
export function getSecondsUntilMidnightET(): number {
  return Math.max(0, 24 * 3600 - getSecondsElapsedTodayET());
}

/** Get the start of the current week (Sunday) in Eastern Time as YYYY-MM-DD. */
export function getWeekStartDateET(date: Date = new Date()): string {
  const easternDateStr = date.toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const [month, day, year] = easternDateStr.split('/').map(Number);
  const easternDate = new Date(year, month - 1, day);

  const dayOfWeek = easternDate.getDay();
  easternDate.setDate(easternDate.getDate() - dayOfWeek);

  return getEasternDateString(easternDate);
}

/** Check if today is Sunday (start of a new week) in Eastern Time. */
export function isNewWeekStartingET(date: Date = new Date()): boolean {
  return convertToEasternTime(date).getDay() === 0;
}
