/**
 * The life events a circle's people know (docs/decisions/0018): when you
 * were born, met someone, married, became a parent, lost someone close; and
 * when you joined this circle. Only ties that touch you, among the people
 * this circle sees.
 */
import type { FactAnswerEntry, HistoryEntry, LifeEvent, Tie } from '@family-trivia/shared';
import { S3_PATHS } from '../../constants';
import { findCircle } from '../circles';
import { addLifeEvents } from '../lifeEvents';
import { getJson } from '../s3';
import { currentScope } from '../scope';
import { loadJoined } from './joined';

type Event = Omit<LifeEvent, 'circleId'>;

const PARTNER: Record<string, string> = {
  married: 'got married',
  partnered: 'got together',
  engaged: 'got engaged',
};
const ENDED: Record<string, string> = { separated: 'separated', divorced: 'divorced' };
const MET_HOW: Record<string, string> = {
  school: 'at school',
  college: 'at college',
  work: 'at work',
  neighbors: 'as neighbors',
  team: 'on a team',
  'through-a-friend': 'through a friend',
  online: 'online',
  family: 'through family',
};

function fromTie(t: Tie, me: string, name: (id: string) => string): Event[] {
  if (t.type === 'friend') {
    const other = t.a === me ? t.b : t.a;
    if (!t.met?.when) return [];
    const how = [t.met.how && MET_HOW[t.met.how], t.met.where && `in ${t.met.where}`]
      .filter(Boolean)
      .join(', ');
    return [
      {
        date: t.met.when,
        kind: 'met',
        title: `You met ${name(other)}`,
        ...(how && { detail: how }),
      },
    ];
  }
  if (t.type === 'partner') {
    const other = t.a === me ? t.b : t.a;
    const out: Event[] = [];
    if (t.since)
      out.push({
        date: t.since,
        kind: 'partner',
        title: `You and ${name(other)} ${PARTNER[t.kind] ?? 'got together'}`,
      });
    if (t.ended?.date) {
      const title =
        t.ended.reason === 'widowed'
          ? `${name(other)} died`
          : `You and ${name(other)} ${ENDED[t.ended.reason] ?? 'parted'}`;
      out.push({
        date: t.ended.date,
        kind: t.ended.reason === 'widowed' ? 'remembered' : 'partner',
        title,
      });
    }
    return out;
  }
  if (t.type === 'parent' && t.parent === me && t.since) {
    const title =
      t.kind === 'birth'
        ? `${name(t.child)} was born`
        : t.kind === 'adoptive'
          ? `You adopted ${name(t.child)}`
          : `You became ${name(t.child)}'s ${t.kind === 'step' ? 'stepparent' : t.kind === 'foster' ? 'foster parent' : 'guardian'}`;
    return [{ date: t.since, kind: 'parent', title }];
  }
  return [];
}

async function firstPlayed(me: string): Promise<string | null> {
  const [answers, facts] = await Promise.all([
    getJson<HistoryEntry[]>(S3_PATHS.ANSWER_HISTORY(me)),
    getJson<FactAnswerEntry[]>(S3_PATHS.FACT_ANSWER_HISTORY(me)),
  ]);
  const dates = [
    ...(answers ?? []).map((h) => h.timestamp),
    ...(facts ?? []).filter((f) => f.answered).map((f) => f.timestamp),
  ].filter((d): d is string => !!d);
  return dates.length ? (dates.sort()[0] as string).slice(0, 10) : null;
}

export async function peopleEvents(me: string): Promise<Event[]> {
  const { visible } = await loadJoined();
  const name = (id: string) => visible.people[id]?.name ?? 'someone';
  const out: Event[] = [];
  const self = visible.people[me];
  if (self?.born?.date)
    out.push({
      date: self.born.date,
      kind: 'born',
      title: 'You were born',
      ...(self.born.place && { detail: `in ${self.born.place}` }),
    });

  const close = new Set<string>();
  for (const t of visible.ties) {
    const ends = t.type === 'parent' ? [t.parent, t.child] : [t.a, t.b];
    if (!ends.includes(me)) continue;
    for (const e of ends) if (e !== me) close.add(e);
    out.push(...fromTie(t, me, name));
  }
  // Someone close to you the circle remembers, unless a tie already said so.
  for (const id of close) {
    const died = visible.people[id]?.memorial?.died;
    if (died && !out.some((e) => e.kind === 'remembered' && e.title.startsWith(name(id))))
      out.push({ date: died, kind: 'remembered', title: `${name(id)} died` });
  }

  const first = await firstPlayed(me);
  if (first) {
    const circle = await findCircle(currentScope().circleId);
    out.push({ date: first, kind: 'joined', title: `You joined ${circle?.name ?? 'the circle'}` });
  }
  return out;
}

addLifeEvents('people', peopleEvents);
