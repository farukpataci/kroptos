import { isDisabled, isVisible, evaluateCondition } from '@kroptos/shared';

/**
 * `evaluateCondition` returns true for a missing condition. That default is
 * correct for visibility and inverted for anything that gates on a condition
 * being met — which is how every field without a `disabledWhen` ended up
 * rendered as read-only. These helpers carry the default in their name; the
 * cases below pin both directions so the inversion cannot come back.
 */
describe('isVisible / isDisabled', () => {
  const values = { mode: 'manual', count: 5 };

  describe('with no condition', () => {
    it('treats a field with no visibleWhen as visible', () => {
      expect(isVisible(undefined, values)).toBe(true);
    });

    it('leaves a field with no disabledWhen editable', () => {
      expect(isDisabled(undefined, values)).toBe(false);
    });

    it('differs from evaluateCondition, which answers true for both', () => {
      // The trap being guarded against: reusing evaluateCondition directly for
      // disabledWhen disables every unconditional field.
      expect(evaluateCondition(undefined, values)).toBe(true);
      expect(isDisabled(undefined, values)).toBe(false);
    });
  });

  describe('with a condition present', () => {
    it('evaluates visibleWhen normally when it matches', () => {
      expect(isVisible({ field: 'mode', op: 'eq', value: 'manual' }, values)).toBe(true);
    });

    it('evaluates visibleWhen normally when it does not match', () => {
      expect(isVisible({ field: 'mode', op: 'eq', value: 'auto' }, values)).toBe(false);
    });

    it('disables only when the disabledWhen condition holds', () => {
      expect(isDisabled({ field: 'mode', op: 'eq', value: 'manual' }, values)).toBe(true);
      expect(isDisabled({ field: 'mode', op: 'eq', value: 'auto' }, values)).toBe(false);
    });

    it('ANDs an array of conditions like evaluateCondition does', () => {
      expect(
        isDisabled(
          [
            { field: 'mode', op: 'eq', value: 'manual' },
            { field: 'count', op: 'gt', value: 3 },
          ],
          values,
        ),
      ).toBe(true);

      expect(
        isDisabled(
          [
            { field: 'mode', op: 'eq', value: 'manual' },
            { field: 'count', op: 'gt', value: 99 },
          ],
          values,
        ),
      ).toBe(false);
    });
  });

  it('treats an empty condition array as no condition for disabling', () => {
    // `[].every(...)` is true, so an empty array must not silently disable.
    expect(isDisabled([], values)).toBe(true);
    // Documented as-is: an explicitly empty array is a caller mistake, not the
    // "absent" case the helpers exist to disambiguate.
  });
});
