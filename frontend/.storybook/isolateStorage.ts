/**
 * Story files run side by side in one browser, and every iframe on the same
 * origin shares localStorage and sessionStorage. One story's saved circle or
 * dismissed tip could change another's result, depending on timing. Each
 * story page gets its own part of both, and `clearStoryStorage` empties it.
 */
const prefix = `story-${Math.random().toString(36).slice(2)}:`;
const proto = Storage.prototype;
const { getItem, setItem, removeItem, key } = proto;
const lengthOf = Object.getOwnPropertyDescriptor(proto, 'length')?.get;

const ownKeys = (s: Storage): string[] => {
  const out: string[] = [];
  const n = lengthOf?.call(s) ?? 0;
  for (let i = 0; i < n; i++) {
    const k = key.call(s, i);
    if (k?.startsWith(prefix)) out.push(k);
  }
  return out;
};

proto.getItem = function (this: Storage, k: string) {
  return getItem.call(this, prefix + k);
};
proto.setItem = function (this: Storage, k: string, v: string) {
  setItem.call(this, prefix + k, v);
};
proto.removeItem = function (this: Storage, k: string) {
  removeItem.call(this, prefix + k);
};
proto.clear = function (this: Storage) {
  for (const k of ownKeys(this)) removeItem.call(this, k);
};

export function clearStoryStorage() {
  localStorage.clear();
  sessionStorage.clear();
}
