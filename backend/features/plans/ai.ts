/** Read what someone dropped into Plans into days (docs/decisions/0026). */
import { addDays } from '@family-trivia/shared';
import { invokeBedrockPrompt } from '../../services/bedrock/core/bedrockClient';
import { findJsonWithKey } from '../../services/bedrock/core/jsonInText';
import { modelFor } from '../../services/bedrock/core/models';
import { collectResponseBody } from '../../services/bedrock/core/responseParser';
import { extractTextContent } from '../../services/bedrock/core/textExtractor';

const weekday = (d: string) =>
  new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });

/** Proposed drops, unchecked: the caller cleans each one. */
export async function readDrops(text: string, today: string): Promise<unknown[]> {
  const model = modelFor('plans');
  const prompt = `Someone wrote what they're doing, for their circle's shared calendar. Today is ${weekday(today)}, ${today}. Turn it into entries.

What they wrote: """${text.slice(0, 400)}"""

Return only JSON: {"drops": [{"kind": "busy|free|plan", "title": "...", "start": "YYYY-MM-DD", "end": "YYYY-MM-DD or omit", "part": "morning|afternoon|evening|all-day or omit", "weekly": true or omit, "until": "YYYY-MM-DD or omit"}]}
- kind: "busy" when they're away or tied up; "free" when they say they're free or open; "plan" when it's something others could join ("who's in", "anyone want to", a party, a trip they're inviting to).
- title: a few plain words ("Beach weekend", "Choir", "Hike at the falls"), no dates in it.
- Dates are on or after today; a weekday means the next one (today counts only if it says "today" or "tonight"). "This weekend" is the coming Saturday and Sunday.
- end only when it spans days. weekly for things that repeat every week ("Tuesday nights", "every Sunday").
- Nothing they didn't say. If there's no date at all, return {"drops": []}.`;
  const stream = await invokeBedrockPrompt(prompt, 500, 0.1, { task: 'plans' }, model);
  const out = extractTextContent(await collectResponseBody(stream), model, 'plans');
  const found = findJsonWithKey<{ drops?: unknown[] }>(out, 'drops');
  return (found?.value.drops ?? []).slice(0, 8);
}

/** How far ahead a drop may start: a year. */
export const latestStart = (today: string) => addDays(today, 365);
