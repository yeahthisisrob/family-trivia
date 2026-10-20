import type { Household, Likeness, Participation, Tie } from '@family-trivia/shared';
import { apiService } from '../../../shared/api/ApiService';

export interface GraphPerson {
  id: string;
  name: string;
  participation: Participation;
  remembered: boolean;
  died: string | null;
  activity?: { facts: number; trivia: number; correct?: number; since?: string | null };
}

export interface GraphData {
  people: GraphPerson[];
  ties: Tie[];
  households: Household[];
  likenesses: Likeness[];
}

export const graphApi = {
  get: () => apiService.request<GraphData>('/graph', { method: 'GET' }, 'family_graph'),
};
