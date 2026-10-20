import { beforeEach, describe, expect, test, vi } from 'vitest';

const crew = { id: 'crew', name: 'The Crew', kind: 'friends', userId: 'al' };
const home = { id: 'home', name: 'The Smiths', kind: 'family', userId: 'alice' };

/** What another tab (or the home-screen app) leaves in the shared storage when it switches. */
function otherTabSwitchesTo(circle: typeof crew) {
  localStorage.setItem(
    'familyTriviaCircles',
    JSON.stringify({ current: circle.id, circles: [home, crew] }),
  );
  localStorage.setItem(
    'familyTriviaSession',
    JSON.stringify({ userId: circle.userId, token: 't', email: 'alice@example.com' }),
  );
}

/** A fresh page load: the session module starts over, as it does after a reload. */
const openTab = async () => {
  vi.resetModules();
  return import('./session');
};

describe('each tab keeps the circle it opened in', () => {
  beforeEach(() => localStorage.clear());

  test('a switch in another tab never changes this one', async () => {
    otherTabSwitchesTo(home);
    const tab = await openTab();
    expect(tab.currentCircleId()).toBe('home');
    expect(tab.loadSession()).toBe('alice');

    otherTabSwitchesTo(crew);
    expect(tab.currentCircleId()).toBe('home');
    expect(tab.loadSession()).toBe('alice');
    expect(tab.loadCircles()?.current).toBe('home');
    expect(tab.currentCircleKind()).toBe('family');
    // A new tab opens where the last switch went.
    expect((await openTab()).currentCircleId()).toBe('crew');
  });

  test('a dismissed note is dismissed in this circle only', async () => {
    otherTabSwitchesTo(home);
    const inHome = (await openTab()).inThisCircle('dismissed');
    otherTabSwitchesTo(crew);
    expect((await openTab()).inThisCircle('dismissed')).not.toBe(inHome);
  });

  test('signing out forgets the tab', async () => {
    otherTabSwitchesTo(home);
    const tab = await openTab();
    tab.currentCircleId();
    tab.clearSession();
    expect(tab.loadSession()).toBeNull();
    expect(tab.currentCircleId()).toBeNull();
  });
});
