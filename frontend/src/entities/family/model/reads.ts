/**
 * The family as server data (docs/decisions/0035): who is in it, how they
 * connect, what the index says about them, and each person's own words.
 * Each read is cached in this tab's circle; a change elsewhere invalidates
 * the key it affects (a saved family, an answer, a picture).
 */
import { useCircleMutation, useCircleQuery } from '../../../shared/api/query';
import { type FamilyResponse, familyApi } from '../api/familyApi';

export const FAMILY = ['family'] as const;
export const GRAPH = ['graph'] as const;
export const KNOWLEDGE = ['knowledge'] as const;
/** Someone's story in their own words: an answer adds to it. */
export const PERSON_STORY = ['person-story'] as const;

/** The family and short-lived links to its photos. */
export function useFamily() {
  const read = useCircleQuery({ key: FAMILY, path: '/family' });
  return {
    family: read.data?.family ?? null,
    photoUrls: read.data?.photoUrls ?? {},
    error: read.isError && !read.data ? "The family didn't load. Try again in a moment." : null,
  };
}

/** Admins save the whole family: the saved one shows at once, and the graph is asked again. */
export const useSaveFamily = () =>
  useCircleMutation({
    mutationFn: familyApi.save,
    onSuccess: (saved: FamilyResponse, _family, cache) => cache.set(FAMILY, () => saved),
    invalidates: [GRAPH],
  });

export const useFamilyGraph = () => useCircleQuery({ key: GRAPH, path: '/graph' });

/** The family's knowledge index: themes, each person's topics and persona, the numbers. */
export const useKnowledge = (enabled = true) =>
  useCircleQuery({ key: KNOWLEDGE, path: '/family/knowledge', enabled });

export const usePersonStory = (personId: string) =>
  useCircleQuery({ key: PERSON_STORY, path: '/family/person-story', query: { personId } });
