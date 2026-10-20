import { apiService } from '../../../shared/api/ApiService';

export interface PersonBook {
  url: string;
  pages: number;
  madeAt: string;
  /** False when the kept copy was still current. */
  made: boolean;
  coverUrl?: string;
}

export const personBookApi = {
  make: (personId: string, fresh = false) =>
    apiService
      .request<PersonBook>(
        '/family/person-book',
        { method: 'POST', body: JSON.stringify({ personId, fresh }) },
        undefined,
        true,
        60_000,
      )
      .then((r) => {
        if (!r?.url) throw new Error('The book didn’t come back');
        return r;
      }),
  versions: (personId: string) =>
    apiService
      .request<{ versions: { madeAt: string; pages: number; url: string; coverUrl?: string }[] }>(
        `/family/person-book/versions?personId=${encodeURIComponent(personId)}`,
        { method: 'GET' },
        undefined,
        true,
      )
      .then((r) => (Array.isArray(r?.versions) ? r.versions : [])),
};
