export type WizardPhase = 'credentials' | 'testing' | 'configure' | 'done';

/**
 * Which screen of how many the seller is looking at.
 *
 * The previous formula was `3 + wizardSteps.length` with the credentials screen
 * numbered 2, which was wrong twice over: the wizard opened on "2 / 9" with no
 * step 1 anywhere, and `done` reused the same number as the last configure step
 * (both landed on 9), so the counter appeared to stall at the end.
 *
 * Counted here is what the seller actually sees: the credentials screen, one
 * screen per manifest wizard step, and the summary. `testing` is not its own
 * step — it is a spinner over the credentials screen while the connection is
 * checked, and the seller has not advanced.
 */
export function wizardProgress(
  phase: WizardPhase,
  stepIndex: number,
  wizardStepCount: number,
): { current: number; total: number } {
  const total = wizardStepCount + 2;

  if (phase === 'credentials' || phase === 'testing') return { current: 1, total };
  if (phase === 'done') return { current: total, total };

  // configure: clamped so a stepIndex past the end cannot report more than the
  // total and make the bar overflow.
  const current = Math.min(2 + Math.max(0, stepIndex), total - 1);
  return { current, total };
}
