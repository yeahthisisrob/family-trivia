/**
 * What the member summary's writer is told about a player's Casino Rush:
 * from the session file it has always read (keys.legacy).
 */
import { getJson } from '../../../services/s3';
import { keys } from './keys';
import type { CasinoRushSession } from './sessions';

/** The prompt section, or '' when the player has no answered Casino Rush questions. */
export async function casinoRushFacts(userId: string): Promise<string> {
  const session = await getJson<CasinoRushSession>(keys.legacy(userId)).catch(() => null);
  const answers = session?.questions?.filter((q) => q.answeredAt) ?? [];
  if (!session || answers.length === 0) return '';

  const correct = answers.filter((q) => q.correct).length;
  const wrong = answers.filter((q) => !q.correct && q.question).map((q) => q.question);
  const byCategory: Record<string, number> = {};
  for (const q of answers) {
    const c = q.category || 'unknown';
    byCategory[c] = (byCategory[c] || 0) + 1;
  }
  const top = Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name]) => name);

  const missed =
    wrong.length > 0
      ? `- Questions they got wrong under pressure:\n${wrong
          .slice(0, 3)
          .map((q) => `  * "${q}"`)
          .join('\n')}`
      : '';
  return `
CASINO RUSH PERFORMANCE:
- Casino Rush session status: ${session.status || 'none'}
- Questions attempted: ${answers.length} (${correct} correct, ${answers.length - correct} wrong)
- Potential points at stake: ${session.potentialPoints || 0}
- Preferred Casino Rush categories: ${top.join(', ') || 'Various'}
${missed}
`;
}
