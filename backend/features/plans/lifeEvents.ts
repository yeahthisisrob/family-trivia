/** Plans you were in, as moments in your life (docs/decisions/0018). */
import { loadJoined } from '../../services/family/joined';
import { addLifeEvents } from '../../services/lifeEvents';
import { pastPlans } from './service';

const list = (names: string[]) =>
  names.length <= 2 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;

addLifeEvents('plans', async (me) => {
  const [plans, { family }] = await Promise.all([pastPlans(me), loadJoined()]);
  const name = (id: string) => family.people[id]?.name ?? id;
  return plans.map((p) => ({
    date: p.date,
    kind: 'plan' as const,
    title: p.with.length ? `${p.title}, with ${list(p.with.map(name))}` : p.title,
    ...(p.memory && {
      detail: `${p.memory.by === me ? 'You' : name(p.memory.by)}: “${p.memory.text.slice(0, 140)}”`,
    }),
  }));
});
