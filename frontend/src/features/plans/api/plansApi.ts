import type { AfterPlan, Drop } from '@family-trivia/shared';
import { apiService } from '../../../shared/api/ApiService';
import { type BodyOf, callApi, type ResponseOf } from '../../../shared/api/contract';

const post = <T>(path: string, body: unknown) =>
  apiService.request<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

/** What an event is made of, as the contract takes it (docs/decisions/0036). */
export type EventInput = BodyOf<'/plans/events', 'post'>;
/** An answer to a plan: going, maybe or can't, a word, how many they bring; null takes it back. */
export type RsvpBody = BodyOf<'/plans/rsvp', 'post'>;

export const plansApi = {
  dropIn: (text: string) => post<{ added: Drop[] }>('/plans', { text }),
  remove: (id: string) => post('/plans/remove', { id }),
  rsvp: (body: RsvpBody) => callApi('/plans/rsvp', { method: 'post', body }),
  remember: (id: string, text: string) =>
    post<{ plans: AfterPlan[] }>('/plans/memory', { id, text }).then((r) => r.plans),
  skip: (id: string) =>
    post<{ plans: AfterPlan[] }>('/plans/memory', { id, skip: true }).then((r) => r.plans),
  createEvent: (body: EventInput) =>
    callApi('/plans/events', { method: 'post', body, once: true }).then((r) => r.event),
  updateEvent: (id: string, body: EventInput) =>
    callApi('/plans/events', { method: 'put', body: { ...body, id } }).then((r) => r.event),
};

/** One event as the caller sees it (GET /plans/events). */
export type EventView = ResponseOf<'/plans/events'>['event'];
/** The circles the caller can share with, and who's in each. */
export type AudienceChoice = ResponseOf<'/plans/events/audience'>['circles'][number];
