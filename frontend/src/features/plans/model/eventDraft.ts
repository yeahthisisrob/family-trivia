/**
 * The event form's state, and the contract's EventInput it becomes
 * (docs/decisions/0036). Leaving the whole of this circle as the audience
 * sends none: that is the default.
 */
import type { AudienceCircle, Drop, Weekday } from '@family-trivia/shared';
import type { EventInput } from '../api/plansApi';

export interface Draft {
  title: string;
  date: string;
  allDay: boolean;
  start: string;
  end: string;
  place: string;
  details: string;
  repeats: boolean;
  days: Weekday[];
  until: string;
  /** Circle id → everyone there (null) or the people chosen; a circle left out isn't asked. */
  audience: Record<string, string[] | null>;
  zone: string;
}

const myZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** A new event on `date` for everyone in this circle; or the event, to change it. */
export function draftOf(here: string, date: string, d?: Drop): Draft {
  return {
    title: d?.title ?? '',
    date: d?.start ?? date,
    allDay: d ? !d.time : false,
    start: d?.time?.start ?? '17:00',
    end: d?.time?.end ?? '',
    place: d?.place ?? '',
    details: d?.details ?? '',
    repeats: !!d?.weekly,
    days: d?.weekly?.days ?? [],
    until: d?.weekly?.until ?? '',
    audience: d?.audience
      ? Object.fromEntries(d.audience.map((a) => [a.circleId, a.people ?? null]))
      : { [here]: null },
    zone: d?.zone ?? myZone(),
  };
}

/** The draft as the API takes it. */
export function inputOf(draft: Draft, here: string): EventInput {
  const audience: AudienceCircle[] = Object.entries(draft.audience).map(([circleId, people]) =>
    people ? { circleId, people } : { circleId },
  );
  const onlyHere = audience.length === 1 && audience[0]?.circleId === here && !audience[0].people;
  return {
    title: draft.title.trim(),
    start: draft.date,
    ...(draft.allDay
      ? {}
      : {
          time: { start: draft.start, ...(draft.end ? { end: draft.end } : {}) },
          zone: draft.zone,
        }),
    ...(draft.place.trim() ? { place: draft.place.trim() } : {}),
    ...(draft.details.trim() ? { details: draft.details.trim() } : {}),
    ...(draft.repeats
      ? {
          weekly: {
            ...(draft.days.length ? { days: draft.days } : {}),
            ...(draft.until ? { until: draft.until } : {}),
          },
        }
      : {}),
    ...(onlyHere ? {} : { audience }),
  };
}

/** An event as it stands, to send back changed (skip a day, cancel it). */
export const toInput = (d: Drop): EventInput => ({
  title: d.title,
  start: d.start,
  ...(d.end && { end: d.end }),
  ...(d.time && { time: d.time, zone: d.zone }),
  ...(d.place && { place: d.place }),
  ...(d.details && { details: d.details }),
  ...(d.weekly && { weekly: d.weekly }),
  ...(d.skip && { skip: d.skip }),
  ...(d.audience && { audience: d.audience }),
  ...(d.cancelled && { cancelled: d.cancelled }),
});
