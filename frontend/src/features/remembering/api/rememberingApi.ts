import type { Comment, CommentThread } from '@family-trivia/shared';
import { apiService } from '../../../shared/api/ApiService';

const q = encodeURIComponent;

export const rememberingApi = {
  /** The family's memories of them: comments on the 'memorial' thread under their id. */
  memories: (personId: string) =>
    apiService
      .request<{ thread: CommentThread }>(
        `/comments?contentType=memorial&contentId=${q(personId)}`,
        { method: 'GET' },
        undefined,
        true,
      )
      .then((r) => r.thread.comments),
  share: (personId: string, text: string) =>
    apiService
      .request<{ comment: Comment }>('/comments', {
        method: 'POST',
        body: JSON.stringify({ contentType: 'memorial', contentId: personId, text }),
      })
      .then((r) => r.comment),
};
