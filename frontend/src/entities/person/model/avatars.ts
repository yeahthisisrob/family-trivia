/**
 * Everyone's chosen picture in this circle, loaded once and shared by every
 * face on screen. A change shows everywhere at once.
 */
import type { AvatarChoice } from '@family-trivia/shared';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { familyApi } from '../../family/api/familyApi';
import { drawAvatar } from './drawAvatar';

let choices: Record<string, AvatarChoice> = {};
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();
const emit = () => {
  for (const l of listeners) l();
};

function load() {
  loading ??= familyApi
    .get()
    .then(({ family }) => {
      choices = Object.fromEntries(
        Object.values(family.people)
          .filter((p) => p.avatar)
          .map((p) => [p.id, p.avatar as AvatarChoice]),
      );
      emit();
    })
    .catch(() => undefined);
  return loading;
}

/** Set one person's picture here (after saving it), or null for initials. */
export function setAvatarChoice(id: string, choice: AvatarChoice | null) {
  const { [id]: _old, ...rest } = choices;
  choices = choice ? { ...rest, [id]: choice } : rest;
  emit();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  void load();
  return () => listeners.delete(l);
};

/** The picture to show for someone: a given choice, else theirs, else none (initials). */
export function useAvatarUri(id: string, given?: AvatarChoice | null): string | undefined {
  const theirs = useSyncExternalStore(subscribe, () => choices[id]);
  const choice = given === undefined ? theirs : given;
  const [uri, setUri] = useState<string>();
  useEffect(() => {
    let live = true;
    if (!choice) setUri(undefined);
    else drawAvatar(choice).then((u) => live && setUri(u));
    return () => {
      live = false;
    };
  }, [choice]);
  return uri;
}
