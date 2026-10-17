/** Where each person's knowledge index lives (shared/src/knowledge.ts), for any feature to read. */
import type { PersonKnowledge } from '@family-trivia/shared';
import { getJson } from './s3';

export const knowledgeKey = (personId: string) => `knowledge/people/${personId}.json`;

export const emptyKnowledge = (personId: string): PersonKnowledge => ({
  personId,
  read: [],
  items: [],
  persona: null,
  updatedAt: new Date(0).toISOString(),
});

export const readKnowledge = async (personId: string) =>
  (await getJson<PersonKnowledge>(knowledgeKey(personId))) ?? emptyKnowledge(personId);
