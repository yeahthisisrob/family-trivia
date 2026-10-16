import type { Comment, CommentThread, Remembering } from '@family-trivia/shared';
import { apiService } from '../../../services/ApiService';

const q = encodeURIComponent;

export const rememberingApi = {
  get: (personId: string) =>
    apiService.request<Remembering>(
      `/family/remembering?personId=${q(personId)}`,
      { method: 'GET' },
      `remembering_${personId}`,
    ),
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
