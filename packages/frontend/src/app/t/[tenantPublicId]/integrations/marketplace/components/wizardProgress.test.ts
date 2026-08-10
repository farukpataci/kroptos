import { wizardProgress } from './wizardProgress';

/**
 * trendyol_global ships six manifest wizard steps, which is what produced the
 * reported "Adım 2 / 9" — the old formula added three phantom screens and
 * started counting at two.
 */
const SIX = 6;

describe('wizardProgress', () => {
  it('opens on the first step, not the second', () => {
    expect(wizardProgress('credentials', 0, SIX).current).toBe(1);
  });

  it('counts the credentials screen, each manifest step and the summary', () => {
    expect(wizardProgress('credentials', 0, SIX).total).toBe(8);
  });

  it('does not treat the connection test as its own step', () => {
    // The spinner sits over the credentials screen; the seller has not moved.
    expect(wizardProgress('testing', 0, SIX)).toEqual(wizardProgress('credentials', 0, SIX));
  });

  it('walks the configure steps one at a time', () => {
    const numbers = Array.from({ length: SIX }, (_, i) => wizardProgress('configure', i, SIX).current);
    expect(numbers).toEqual([2, 3, 4, 5, 6, 7]);
  });

  it('gives the summary its own number instead of reusing the last step', () => {
    const lastConfigure = wizardProgress('configure', SIX - 1, SIX).current;
    const done = wizardProgress('done', SIX - 1, SIX).current;

    expect(done).toBe(8);
    expect(done).not.toBe(lastConfigure);
  });

  it('never reports more than the total', () => {
    for (const phase of ['credentials', 'testing', 'configure', 'done'] as const) {
      for (let i = 0; i < SIX + 3; i++) {
        const { current, total } = wizardProgress(phase, i, SIX);
        expect(current).toBeGreaterThanOrEqual(1);
        expect(current).toBeLessThanOrEqual(total);
      }
    }
  });

  it('handles a provider with no manifest wizard steps', () => {
    expect(wizardProgress('credentials', 0, 0)).toEqual({ current: 1, total: 2 });
    expect(wizardProgress('done', 0, 0)).toEqual({ current: 2, total: 2 });
  });

  it('clamps a step index past the end rather than overflowing the bar', () => {
    const { current, total } = wizardProgress('configure', 99, SIX);
    expect(current).toBe(total - 1);
  });
});
