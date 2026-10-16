/**
 * Which catalog models this AWS account can actually call. Each is pinged
 * with a one-token request (a fraction of a cent) and the result is kept for
 * a day, because model access is granted per account in the Bedrock console.
 */
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { MODEL_CATALOG } from '@family-trivia/shared';
import { REGION } from '../../config';
import { getJson, putJson } from '../../services/s3';

const KEY = 'config/model-availability.json';
const DAY_MS = 24 * 60 * 60 * 1000;

export interface Availability {
  checkedAt: string;
  models: Record<string, { ok: boolean; reason?: string }>;
}

const client = new BedrockRuntimeClient({ region: REGION });

async function ping(id: string): Promise<{ ok: boolean; reason?: string }> {
  try {
    await client.send(
      new InvokeModelCommand({
        modelId: id,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          anthropic_version: 'bedrock-2023-05-31',
          max_tokens: 1,
          messages: [{ role: 'user', content: [{ type: 'text', text: 'Hi' }] }],
        }),
      }),
    );
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const reason = /end of its life/i.test(msg)
      ? 'Retired by AWS'
      : /not available|access|denied|authorized/i.test(msg)
        ? 'Not enabled for this AWS account (Bedrock console › Model access)'
        : msg.slice(0, 120);
    return { ok: false, reason };
  }
}

export async function modelAvailability(refresh = false): Promise<Availability> {
  const cached = await getJson<Availability>(KEY);
  if (!refresh && cached && Date.now() - Date.parse(cached.checkedAt) < DAY_MS) return cached;
  const results = await Promise.all(
    MODEL_CATALOG.map(async (m) => [m.id, await ping(m.id)] as const),
  );
  const fresh: Availability = {
    checkedAt: new Date().toISOString(),
    models: Object.fromEntries(results),
  };
  await putJson(KEY, fresh);
  return fresh;
}
