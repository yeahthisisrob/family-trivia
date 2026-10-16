/**
 * Find a JSON object with a given key inside model output: bare, in a code
 * fence, pretty-printed or surrounded by prose. Models change how they format
 * JSON between versions; parsing shouldn't depend on it.
 */
export function findJsonWithKey<T = unknown>(
  text: string,
  key: string,
): { value: T; start: number; end: number } | null {
  const needle = new RegExp(`\\{\\s*"${key}"\\s*:`, 'g');
  for (let m = needle.exec(text); m; m = needle.exec(text)) {
    // Walk forward to the matching brace, respecting strings.
    let depth = 0;
    let inString = false;
    for (let i = m.index; i < text.length; i++) {
      const c = text[i];
      if (inString) {
        if (c === '\\') i++;
        else if (c === '"') inString = false;
      } else if (c === '"') inString = true;
      else if (c === '{') depth++;
      else if (c === '}' && --depth === 0) {
        try {
          return { value: JSON.parse(text.slice(m.index, i + 1)) as T, start: m.index, end: i + 1 };
        } catch {
          break;
        }
      }
    }
  }
  return null;
}

/** The text with that JSON object (and any code fence around it) removed. */
export function withoutJsonKey(text: string, key: string): string {
  const found = findJsonWithKey(text, key);
  if (!found) return text.trim();
  const before = text.slice(0, found.start).replace(/```(?:json)?\s*$/, '');
  const after = text.slice(found.end).replace(/^\s*```/, '');
  return `${before}${after}`.trim();
}
