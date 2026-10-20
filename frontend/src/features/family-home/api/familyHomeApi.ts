import { callApi } from '../../../shared/api/contract';

/** What admins change on Us: the family's story, and its knowledge index. */
export const familyHomeApi = {
  writeStory: () => callApi('/admin/family/story', { method: 'post' }),
  /** Reads the next batch of answers into the index; call again while `left` > 0. */
  buildKnowledge: () => callApi('/admin/knowledge/build', { method: 'post' }),
};
