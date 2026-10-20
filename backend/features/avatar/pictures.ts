/**
 * Pictures made for someone (docs/decisions/0024): an illustration of an
 * animal or a thing that fits what they love, never a face or text, from one
 * low-cost image model. Kept in the circle's private media; at most a few a
 * day per person.
 */
import { randomUUID } from 'node:crypto';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { AI_PICTURES_PER_DAY, aiAvatarKey, getTodayET, topItems } from '@family-trivia/shared';
import { recordUsage } from '../../services/bedrock/core/usage';
import { readKnowledge } from '../../services/knowledge';
import { logger } from '../../services/logger';
import { readUrl } from '../../services/media';
import { getJson, putBytes, putJson } from '../../services/s3';

/** Stable Image Core: about four cents a picture, the cheapest image model on offer. */
const MODEL = process.env.BEDROCK_IMAGE_MODEL || 'stability.stable-image-core-v1:1';
const REGION = process.env.BEDROCK_IMAGE_REGION || 'us-west-2';
const client = new BedrockRuntimeClient({ region: REGION });

const madeKey = (userId: string) => `media-made/${userId}.json`;

/** What the picture is of: their words if given, else what they love. */
export function picturePrompt(loves: string[], hint?: string): string {
  const about = hint?.trim()
    ? hint.trim().slice(0, 160)
    : loves.length
      ? `an animal or object that playfully suggests someone who loves ${loves.slice(0, 3).join(', ')}`
      : 'a friendly animal';
  return `A friendly flat vector avatar illustration of ${about}, centered, bold simple shapes, warm colors, soft pastel circular background, cheerful. No people, no human faces, no text, no letters.`;
}

export type MakeResult =
  | { ok: true; key: string; url: string; left: number }
  | { ok: false; status: 429 | 502; error: string };

export async function makePicture(userId: string, hint?: string): Promise<MakeResult> {
  const today = getTodayET();
  const made = (await getJson<{ day: string; count: number }>(madeKey(userId))) ?? {
    day: today,
    count: 0,
  };
  const count = made.day === today ? made.count : 0;
  if (count >= AI_PICTURES_PER_DAY)
    return { ok: false, status: 429, error: 'That’s today’s pictures. More tomorrow.' };

  const loves = topItems(await readKnowledge(userId), 8)
    .filter((t) => t.kind !== 'person' && t.kind !== 'memory')
    .map((t) => t.name);
  try {
    const res = await client.send(
      new InvokeModelCommand({
        modelId: MODEL,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
          prompt: picturePrompt(loves, hint),
          negative_prompt: 'person, human, face, text, letters, watermark, scary',
          aspect_ratio: '1:1',
          // Stable Image Core makes png or jpeg; jpeg keeps a picture small.
          output_format: 'jpeg',
        }),
      }),
    );
    const out = JSON.parse(new TextDecoder().decode(res.body)) as {
      images?: string[];
      finish_reasons?: (string | null)[];
    };
    const image = out.images?.[0];
    if (!image || out.finish_reasons?.[0])
      throw new Error(`No picture (${out.finish_reasons?.[0]})`);
    const key = aiAvatarKey(userId, randomUUID());
    await putBytes(key, Buffer.from(image, 'base64'), 'image/jpeg');
    await putJson(madeKey(userId), { day: today, count: count + 1 });
    // One "output" per picture; Settings prices it per picture.
    recordUsage('pictures', MODEL, 0, 1);
    return {
      ok: true,
      key,
      url: (await readUrl(key)) ?? '',
      left: AI_PICTURES_PER_DAY - count - 1,
    };
  } catch (err) {
    logger.error('Picture failed', { error: err instanceof Error ? err.message : String(err) });
    return { ok: false, status: 502, error: 'The picture didn’t come out. Try again.' };
  }
}
