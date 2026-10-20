/**
 * GET and PUT /reactions. Each bar on screen asks for its own item; the asks
 * made in the same moment, in the same circle, go out as one request.
 */
import type { ReactableType, ReactionId, ReactionSummary } from '@family-trivia/shared';
import { apiService } from '../../../shared/api/ApiService';
import { callApi, type ResponseOf } from '../../../shared/api/contract';

export type Reactions = ResponseOf<'/reactions'>;

export const NO_REACTIONS: ReactionSummary = { by: [], mine: null };

/** The API takes up to 200 ids; fewer keeps one slow answer small. */
const MOST_IDS = 100;
/** How long a bar waits for others to ask with it. */
const GATHER_MS = 30;

interface Ask {
  id: string;
  answered: (r: Reactions) => void;
  failed: (e: unknown) => void;
}

const gathering = new Map<string, Ask[]>();

async function askTogether(circle: string | null, type: ReactableType, asks: Ask[]) {
  for (let i = 0; i < asks.length; i += MOST_IDS) {
    const batch = asks.slice(i, i + MOST_IDS);
    const ids = [...new Set(batch.map((a) => a.id))];
    try {
      const { reactions } = await callApi('/reactions', {
        query: { contentType: type, ids: ids.join(',') },
        circle,
      });
      for (const a of batch) a.answered({ reactions: { [a.id]: reactions[a.id] ?? NO_REACTIONS } });
    } catch (e) {
      for (const a of batch) a.failed(e);
    }
  }
}

export const reactionsApi = {
  /** One item's reactions, in the circle given, asked together with the rest on screen. */
  get: (circle: string | null, type: ReactableType, id: string) =>
    new Promise<Reactions>((answered, failed) => {
      const together = `${circle}|${type}`;
      const asks = gathering.get(together);
      if (asks) {
        asks.push({ id, answered, failed });
        return;
      }
      gathering.set(together, [{ id, answered, failed }]);
      setTimeout(() => {
        const all = gathering.get(together) ?? [];
        gathering.delete(together);
        void askTogether(circle, type, all);
      }, GATHER_MS);
    }),
  set: (type: ReactableType, contentId: string, reaction: ReactionId | null) =>
    apiService.request<{ contentId: string; summary: ReactionSummary }>('/reactions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contentType: type, contentId, reaction }),
    }),
};
