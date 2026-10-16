import { apiService } from '../../../services/ApiService';

export interface PersonBook {
  url: string;
  pages: number;
  madeAt: string;
  /** False when the kept copy was still current. */
  made: boolean;
}

export const personBookApi = {
  make: (personId: string, fresh = false) =>
    apiService.request<PersonBook>(
      '/family/person-book',
      { method: 'POST', body: JSON.stringify({ personId, fresh }) },
      undefined,
      true,
      60_000,
    ),
  versions: (personId: string) =>
    apiService
      .request<{ versions: { madeAt: string; pages: number; url: string }[] }>(
        `/family/person-book/versions?personId=${encodeURIComponent(personId)}`,
        { method: 'GET' },
        undefined,
        true,
      )
      .then((r) => r.versions),
};
