import { act } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('../../../shared/config/config', () => ({
  loadConfig: async () => ({ REACT_APP_API_URL: 'https://api.test' }),
}));

import { apiService } from '../../../shared/api/ApiService';
import { fakeApi, openTabIn, renderWithServerData } from '../../../test/serverData';
import { CirclesAdmin } from './CirclesAdmin';

const circle = (id: string, name: string) => ({
  id,
  name,
  kind: 'friends',
  createdAt: '2026-10-01T00:00:00.000Z',
  createdBy: 'alice',
});

/** Type into a React-controlled field the way a person does. */
const type = (input: HTMLInputElement, text: string) =>
  act(async () => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    set?.call(input, text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
const press = (name: string) =>
  act(async () => {
    [...document.querySelectorAll('button')].find((b) => b.textContent === name)?.click();
  });

describe('Admin › Circles', () => {
  beforeEach(() => {
    localStorage.clear();
    apiService.clearCache();
  });
  afterEach(() => vi.unstubAllGlobals());

  test('a circle just started shows in the list without a reload', async () => {
    const circles = [circle('crew', 'The Crew')];
    fakeApi({
      'GET /admin/circles': () => ({ owner: true, circles }),
      'POST /admin/circles': (_circle, _url, body) => {
        const made = circle('book-club', (body as { name: string }).name);
        circles.push(made);
        return { circle: made, circles: [] };
      },
    });
    openTabIn('crew');
    const view = renderWithServerData(<CirclesAdmin currentId="crew" yourName="Alice" />);
    await vi.waitFor(() => expect(view.container.textContent).toContain('The Crew'));

    await press('Start a circle');
    const name = [...document.querySelectorAll('label')]
      .find((l) => l.textContent?.startsWith('Name'))
      ?.parentElement?.querySelector('input') as HTMLInputElement;
    await type(name, 'The Book Club');
    await press('Start and open it');
    await vi.waitFor(() => expect(document.body.textContent).toContain('The Book Club is ready'));
    await press('Stay here');

    await vi.waitFor(() => expect(view.container.textContent).toContain('The Book Club'));
    view.unmount();
  });
});
