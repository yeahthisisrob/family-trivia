/**
 * Small checks for structured answers (askStructured's `check`, 0033). Model
 * output is untrusted: a guard says whether a value has the shape asked for.
 */

/** A plain object (not null, not an array). */
export const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** A string with something in it. */
export const isFilled = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

/** An object whose `key` is a list of objects: the usual shape of an answer that is a list. */
export const hasListOf = <K extends string>(
  v: unknown,
  key: K,
): v is Record<K, Record<string, unknown>[]> =>
  isRecord(v) && Array.isArray(v[key]) && (v[key] as unknown[]).every(isRecord);

/** A JSON Schema for an object holding one list of objects. */
export const listSchema = (
  key: string,
  item: Record<string, unknown>,
  required: string[],
  extra: Record<string, unknown> = {},
) => ({
  type: 'object',
  properties: {
    [key]: { type: 'array', items: { type: 'object', properties: item, required }, ...extra },
  },
  required: [key],
});
