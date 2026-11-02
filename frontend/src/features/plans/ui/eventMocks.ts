/** A made-up circle's events, for stories (never a real family: docs/decisions/0006). */
import { addDays, type Drop, getTodayET, plansView } from '@family-trivia/shared';
import type { AudienceChoice, EventView } from '../api/plansApi';
import { monthWindow } from '../model/calendar';

const today = getTodayET();
export const day = (n: number) => addDays(today, n);
const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;

const names: Record<string, string> = {
  alice: 'Alice',
  bob: 'Bob',
  carol: 'Carol',
  dave: 'Dave',
  erin: 'Erin',
};
export const nameOf = (id: string) => names[id] ?? id;

export const birthday: Drop = {
  id: 'carol-bday',
  by: 'carol',
  kind: 'plan',
  title: "Dave's birthday dinner",
  start: day(4),
  time: { start: '18:00', end: '20:30' },
  zone,
  place: "Grandpa's house, Springfield",
  details: 'Bring a dish to share. Cake at seven.',
  createdAt: today,
};

const gymnastics: Drop = {
  id: 'alice-gym',
  by: 'alice',
  kind: 'plan',
  title: 'Gymnastics',
  start: day(1),
  time: { start: '17:30', end: '18:30' },
  zone,
  place: 'Springfield Gym',
  details: 'Anyone can come and watch.',
  weekly: { until: day(90) },
  audience: [{ circleId: 'home' }, { circleId: 'crew', people: ['erin'] }],
  createdAt: today,
};

export const birthdayView: EventView = {
  event: birthday,
  invited: ['alice', 'bob', 'carol', 'dave'],
  rsvps: {
    bob: { answer: 'in', guests: 2, note: 'Bringing the twins', at: today },
    dave: { answer: 'in', at: today },
    alice: { answer: 'maybe', note: 'Might be late', at: today },
  },
  elsewhere: [],
  canEdit: false,
};

export const gymnasticsView: EventView = {
  event: gymnastics,
  invited: ['alice', 'bob', 'carol', 'dave'],
  rsvps: { carol: { answer: 'in', at: today } },
  elsewhere: [{ name: 'The Crew', in: 1, maybe: 0, out: 0, guests: 0 }],
  canEdit: true,
};

export const circles: AudienceChoice[] = [
  {
    circleId: 'home',
    name: 'The Smiths',
    me: 'alice',
    people: ['alice', 'bob', 'carol', 'dave'].map((id) => ({ id, name: nameOf(id) })),
  },
  {
    circleId: 'crew',
    name: 'The Crew',
    me: 'al',
    people: [
      { id: 'al', name: 'Alice' },
      { id: 'erin', name: 'Erin' },
      { id: 'frank', name: 'Frank' },
    ],
  },
];

/** A month of a made-up circle's calendar: a weekly class, a dinner, a cancelled visit and a hike. */
export function monthOf(month: string) {
  const { from, to } = monthWindow(month);
  const drops: Drop[] = [
    { ...gymnastics, start: from, weekly: { days: ['TU', 'TH'] } },
    birthday,
    {
      id: 'bob-visit',
      by: 'bob',
      kind: 'plan',
      title: "Grandpa's for the train set",
      start: day(2),
      time: { start: '16:30' },
      zone,
      place: "Grandpa's house",
      cancelled: true,
      createdAt: today,
    },
    {
      id: 'dave-hike',
      by: 'dave',
      kind: 'plan',
      title: 'Hike at the falls',
      start: day(6),
      createdAt: today,
    },
  ];
  const rsvps = { [birthday.id]: birthdayView.rsvps, [gymnastics.id]: gymnasticsView.rsvps };
  return plansView('alice', Object.keys(names), drops, rsvps, from, to);
}
