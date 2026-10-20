import { CIRCLE_HEADER, SETTINGS, type SettingValue } from '@family-trivia/shared';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../../../shared/config/config', () => ({
  loadConfig: async () => ({ REACT_APP_API_URL: 'https://api.test' }),
}));

import { useFeatures } from '../../../entities/settings';
import { apiService } from '../../../shared/api/ApiService';
import { fakeApi, openTabIn, renderWithServerData } from '../../../test/serverData';
import { SettingsPage } from './SettingsPage';

/** The admin view as the API answers it, from what each circle has saved. */
const view = (saved: Record<string, SettingValue>) => ({
  settings: SETTINGS.map((s) => ({
    ...s,
    value: s.key in saved ? saved[s.key] : s.default,
    source: s.key in saved ? 'stored' : 'default',
  })),
  models: [],
  availabilityCheckedAt: '2026-10-20T00:00:00.000Z',
  tasks: [],
  defaults: { writer: 'w', fast: 'f' },
  players: 3,
  usage: { thisMonth: {}, lastMonth: {} },
});

/** Each circle keeps its own settings, as the API does. */
function settingsApi() {
  const saved: Record<string, Record<string, SettingValue>> = { crew: {}, home: {} };
  const of = (circle: string | null) => saved[circle ?? ''] ?? {};
  const fetch = fakeApi({
    'GET /admin/settings': (circle) => view(of(circle)),
    'PUT /admin/settings': (circle, _url, body) => {
      Object.assign(of(circle), (body as { values: Record<string, SettingValue> }).values);
      return view(of(circle));
    },
    'GET /settings/features': (circle) => ({ arcade: of(circle)['features.arcade'] !== false }),
  });
  return { fetch, saved };
}

const Arcade: React.FC = () => <p id="arcade">{useFeatures().arcade ? 'on' : 'off'}</p>;

const screen = () => (
  <MemoryRouter initialEntries={['/admin/settings?section=features']}>
    <SettingsPage />
    <Arcade />
  </MemoryRouter>
);

const click = (el: Element | null | undefined) =>
  act(async () => {
    (el as HTMLElement).click();
  });
const switchFor = (root: HTMLElement, label: string) =>
  [...root.querySelectorAll('label')].find((l) => l.textContent === label)?.querySelector('input');
const buttonNamed = (root: HTMLElement, name: string) =>
  [...root.querySelectorAll('button')].find((b) => b.textContent === name);

describe('Admin › Settings', () => {
  beforeEach(() => {
    localStorage.clear();
    apiService.clearCache();
  });
  afterEach(() => vi.unstubAllGlobals());

  test('turning the Arcade off shows on every screen that asks, once saved', async () => {
    settingsApi();
    openTabIn('home');
    const page = renderWithServerData(screen());
    const arcade = () => page.container.querySelector('#arcade')?.textContent;
    await vi.waitFor(() => expect(switchFor(page.container, 'Arcade')).toBeTruthy());
    expect(arcade()).toBe('on');

    await click(switchFor(page.container, 'Arcade'));
    await click(buttonNamed(page.container, 'Save'));
    await vi.waitFor(() => expect(page.container.textContent).toContain('Saved.'));
    await vi.waitFor(() => expect(arcade()).toBe('off'));
    page.unmount();
  });

  test("an admin of two circles never sees or saves into the other circle's settings", async () => {
    const { fetch, saved } = settingsApi();
    saved.crew = { 'features.arcade': false };
    openTabIn('crew');
    const crew = renderWithServerData(screen());
    await vi.waitFor(() =>
      expect((switchFor(crew.container, 'Arcade') as HTMLInputElement).checked).toBe(false),
    );
    crew.unmount();

    openTabIn('home');
    const home = renderWithServerData(screen(), crew.client);
    await vi.waitFor(() =>
      expect((switchFor(home.container, 'Arcade') as HTMLInputElement | undefined)?.checked).toBe(
        true,
      ),
    );
    await click(switchFor(home.container, 'Photo albums'));
    await click(buttonNamed(home.container, 'Save'));
    await vi.waitFor(() => expect(home.container.textContent).toContain('Saved.'));

    const puts = fetch.mock.calls.filter(([, init]) => init?.method === 'PUT');
    expect(puts).toHaveLength(1);
    const headers = puts[0]?.[1]?.headers as Record<string, string> | undefined;
    expect(headers?.[CIRCLE_HEADER]).toBe('home');
    expect(saved.crew).toEqual({ 'features.arcade': false });
    expect(saved.home).toEqual({ 'features.photos': false });
    const crewReads = crew.client.getQueryCache().findAll({ queryKey: ['circle', 'crew'] });
    expect(crewReads.length).toBeGreaterThan(0);
    expect(crewReads.every((q) => !q.state.isInvalidated)).toBe(true);
    home.unmount();
  });
});
