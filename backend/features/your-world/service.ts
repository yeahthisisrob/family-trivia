/**
 * Your world (docs/decisions/0018): read each of the viewer's circles as they
 * see it, then match across them for this viewer alone. Nothing is stored,
 * and nothing found here goes back into any circle.
 */
import {
  isPlaying,
  isRemembered,
  itemKey,
  tieEnds,
  topItems,
  type WorldMeet,
  type WorldThread,
  type WorldView,
} from '@family-trivia/shared';
import { accountsIn, findCircle, myCircles, scopeOf } from '../../services/circles';
import { loadJoined } from '../../services/family/joined';
import { readKnowledge } from '../../services/knowledge';
import { inCircle } from '../../services/scope';

const THREADS = 12;
const MEET = 6;

export async function yourWorld(email: string): Promise<WorldView> {
  const mine = await myCircles(email);
  const circles = (await Promise.all(mine.map((m) => findCircle(m.id)))).filter(
    (c): c is NonNullable<typeof c> => !!c,
  );
  const view: WorldView = {
    circles: circles.map((c) => ({ id: c.id, name: c.name, kind: c.kind })),
    enough: circles.length >= 2,
    nodes: [],
    links: [],
    threads: [],
    meet: [],
  };
  if (!view.enough) return view;

  const byAccount = new Map<string, string[]>(); // account → node ids
  const items = new Map<string, { name: string; kind: WorldThread['kind']; people: Set<string> }>();

  for (const circle of circles) {
    const meHere = mine.find((m) => m.id === circle.id)?.userId;
    const accounts = await inCircle(scopeOf(circle), async () => {
      const { visible } = await loadJoined();
      const shown = Object.values(visible.people).filter((p) => isPlaying(p) || isRemembered(p));
      const ids = new Set(shown.map((p) => p.id));
      const node = (id: string) => `${circle.id}:${id}`;
      for (const t of visible.ties) {
        const [a, b] = tieEnds(t);
        if (ids.has(a) && ids.has(b)) view.links.push({ a: node(a), b: node(b), kind: 'tie' });
      }
      for (const p of shown) {
        view.nodes.push({
          id: node(p.id),
          circleId: circle.id,
          personId: p.id,
          name: p.name,
          ...(p.id === meHere ? { me: true } : {}),
        });
        if (p.noAiMentions) continue;
        for (const t of topItems(await readKnowledge(p.id), 10)) {
          if (t.kind === 'person' || t.kind === 'memory') continue;
          const key = itemKey(t.kind, t.name);
          const it = items.get(key) ?? { name: t.name, kind: t.kind, people: new Set<string>() };
          it.people.add(node(p.id));
          items.set(key, it);
        }
      }
      return accountsIn(circle);
    });
    for (const [account, userId] of Object.entries(accounts)) {
      const ids = byAccount.get(account) ?? [];
      ids.push(`${circle.id}:${userId}`);
      byAccount.set(account, ids);
    }
  }

  // The same sign-in in two circles is one person: a bridge (the viewer is always one).
  const known = new Set(view.nodes.map((n) => n.id));
  for (const ids of byAccount.values()) {
    const here = ids.filter((id) => known.has(id));
    if (here.length < 2) continue;
    for (const n of view.nodes) if (here.includes(n.id)) n.bridge = true;
    for (let i = 1; i < here.length; i++)
      view.links.push({ a: here[0] as string, b: here[i] as string, kind: 'same' });
  }

  // Threads: what comes up in more than one circle. Who should meet: across circles, not the same person.
  const circleOf = (id: string) => id.slice(0, id.indexOf(':'));
  const samePerson = (a: string, b: string) =>
    view.links.some(
      (l) => l.kind === 'same' && ((l.a === a && l.b === b) || (l.a === b && l.b === a)),
    );
  const shared = [...items.values()]
    .map((it) => ({ ...it, people: [...it.people] }))
    .filter((it) => new Set(it.people.map(circleOf)).size >= 2)
    .sort((a, b) => b.people.length - a.people.length || a.name.localeCompare(b.name));
  view.threads = shared.slice(0, THREADS).map(({ name, kind, people }) => ({ name, kind, people }));
  const seen = new Set<string>();
  for (const t of shared) {
    for (const a of t.people)
      for (const b of t.people) {
        if (view.meet.length >= MEET) break;
        const pair = [a, b].sort().join('|');
        if (a === b || circleOf(a) === circleOf(b) || samePerson(a, b) || seen.has(pair)) continue;
        const isMe = (id: string) => view.nodes.find((n) => n.id === id)?.me;
        if (isMe(a) || isMe(b)) continue;
        seen.add(pair);
        view.meet.push({ a, b, because: t.name } satisfies WorldMeet);
      }
  }
  return view;
}
