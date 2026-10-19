/**
 * Everyone's chosen picture in this circle, loaded once and shared by every
 * face on screen. A change shows everywhere at once.
 */
import type { AvatarChoice } from '@family-trivia/shared';
import { useSyncExternalStore } from 'react';
import { familyApi } from '../../family/api/familyApi';
import { type Look, lookOf } from './look';

let choices: Record<string, AvatarChoice> = {};
let urls: Record<string, string> = {};
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();
const emit = () => {
  for (const l of listeners) l();
};

function load() {
  loading ??= familyApi
    .get()
    .then(({ family, photoUrls }) => {
      urls = { ...urls, ...photoUrls };
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
export function setAvatarChoice(id: string, choice: AvatarChoice | null, url?: string) {
  const { [id]: _old, ...rest } = choices;
  choices = choice ? { ...rest, [id]: choice } : rest;
  if (choice?.library === 'ai' && url) urls = { ...urls, [choice.key]: url };
  emit();
}

/** Remember a made picture's link, so a preview can show it. */
export function rememberPictureUrl(key: string, url: string) {
  urls = { ...urls, [key]: url };
  emit();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  void load();
  return () => listeners.delete(l);
};

/** How to show someone: a given choice, else theirs, else nothing (initials). */
export function useAvatarLook(id: string, given?: AvatarChoice | null): Look | undefined {
  const theirs = useSyncExternalStore(subscribe, () => choices[id]);
  const known = useSyncExternalStore(subscribe, () => urls);
  const choice = given === undefined ? theirs : given;
  return choice ? lookOf(choice, known) : undefined;
}
