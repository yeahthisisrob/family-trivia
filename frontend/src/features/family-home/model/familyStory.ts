/**
 * The family's story at the top of Us, and the admin changes behind it, as
 * server data (docs/decisions/0035). Writing the story again shows the new
 * one at once; reading answers into the index asks for the index again.
 */
import { KNOWLEDGE } from '../../../entities/family';
import type { ResponseOf } from '../../../shared/api/contract';
import { useCircleMutation, useCircleQuery } from '../../../shared/api/query';
import { familyHomeApi } from '../api/familyHomeApi';

export type FamilyStory = ResponseOf<'/family/story'>;
type Batch = ResponseOf<'/admin/knowledge/build', 'post'>;

const FAMILY_STORY = ['family-story'] as const;

/** A guard on a run that never ends: each batch reads a few answers. */
const MOST_BATCHES = 200;

export const useFamilyStory = () => useCircleQuery({ key: FAMILY_STORY, path: '/family/story' });

export const useWriteStory = () =>
  useCircleMutation({
    mutationFn: familyHomeApi.writeStory,
    onSuccess: (story: FamilyStory, _vars, cache) => cache.set(FAMILY_STORY, () => story),
  });

interface IndexRun {
  /** After each batch: what it read, and how many answers are left. */
  onBatch: (batch: Batch) => void;
  /** The page closed: stop between batches. */
  stopped: () => boolean;
}

/** Read every new answer into the index, a batch at a time, then ask for the index again. */
export const useBuildKnowledge = ({ onBatch, stopped }: IndexRun) =>
  useCircleMutation({
    mutationFn: async () => {
      for (let guard = 0; guard < MOST_BATCHES && !stopped(); guard++) {
        const batch = await familyHomeApi.buildKnowledge();
        onBatch(batch);
        if (batch.left === 0 || (batch.read === 0 && batch.personas === 0)) break;
      }
    },
    invalidates: [KNOWLEDGE],
  });
