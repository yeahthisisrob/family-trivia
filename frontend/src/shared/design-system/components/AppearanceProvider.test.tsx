import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, test } from 'vitest';
import { AppearanceProvider, useAppearance } from './AppearanceProvider';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Open the app's look in a circle, and read it as it changes. */
function inCircle(circleId: string) {
  const result = { current: null as unknown as ReturnType<typeof useAppearance> };
  const Probe = () => {
    result.current = useAppearance();
    return null;
  };
  const root = createRoot(document.createElement('div'));
  act(() =>
    root.render(
      <AppearanceProvider circleId={circleId}>
        <Probe />
      </AppearanceProvider>,
    ),
  );
  return { result, unmount: () => act(() => root.unmount()) };
}

describe('a theme belongs to the circle it was picked in', () => {
  beforeEach(() => localStorage.clear());

  test('picking a theme in one circle leaves the other on its own', () => {
    const crew = inCircle('crew');
    const [first, second] = crew.result.current.themes;
    act(() => crew.result.current.setFamilyTheme(first?.id ?? null));
    act(() => crew.result.current.setTheme(second?.id ?? null));
    expect(crew.result.current.theme.id).toBe(second?.id);
    crew.unmount();

    const home = inCircle('home');
    expect(home.result.current.chosenThemeId).toBeNull();
  });

  test("a circle's own theme shows at once on the next visit, with no flash of another", () => {
    const crew = inCircle('crew');
    const last = crew.result.current.themes.at(-1);
    act(() => crew.result.current.setFamilyTheme(last?.id ?? null));
    crew.unmount();
    const again = inCircle('crew');
    expect(again.result.current.theme.id).toBe(last?.id);
  });

  test('a pick from before circles moves into the first circle that opens', () => {
    localStorage.setItem('ft:appearance', JSON.stringify({ themeId: 'classic' }));
    const home = inCircle('home');
    expect(home.result.current.chosenThemeId).toBe('classic');
    act(() => home.result.current.setFamilyTheme('sunset'));
    home.unmount();
    const crew = inCircle('crew');
    expect(crew.result.current.chosenThemeId).toBeNull();
  });
});
