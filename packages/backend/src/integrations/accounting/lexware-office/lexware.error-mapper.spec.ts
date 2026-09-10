import {
  LexwareErrorMapper,
  LexwareValidationError,
  LexwareVersionConflictError,
} from './lexware.error-mapper';
import {
  AccountingAuthError,
  AccountingRateLimitError,
} from '../core/AccountingErrors';

describe('LexwareErrorMapper (§3.6, §5.3)', () => {
  it('classifies HTTP 406 strictly as LexwareValidationError with isRetryable false', () => {
    const err = LexwareErrorMapper.mapError(406, {
      i18nKey: 'invalid_property',
      message: 'Some German human message: Eigenschaft ungültig',
      traceId: 'trace-1234',
    });

    expect(err).toBeInstanceOf(LexwareValidationError);
    const valErr = err as LexwareValidationError;
    expect(valErr.statusCode).toBe(406);
    expect(valErr.isRetryable).toBe(false);
    expect(valErr.i18nKey).toBe('invalid_property');
    expect(valErr.message).toContain('invalid_property');
    expect(valErr.message).toContain('trace-1234');
  });

  it('classifies based on i18nKey regardless of human message text changes (§9 item 5)', () => {
    const err1 = LexwareErrorMapper.mapError(406, {
      i18nKey: 'voucher_closed',
      message: 'Original German text: Beleg ist bereits abgeschlossen',
    });

    const err2 = LexwareErrorMapper.mapError(406, {
      i18nKey: 'voucher_closed',
      message: 'Completely different wording or English message: Document finalized',
    });

    expect(err1).toBeInstanceOf(LexwareValidationError);
    expect(err2).toBeInstanceOf(LexwareValidationError);
    expect((err1 as LexwareValidationError).i18nKey).toBe('voucher_closed');
    expect((err2 as LexwareValidationError).i18nKey).toBe('voucher_closed');
  });

  it('handles unknown i18nKey by preserving the key and marking as permanent validation error', () => {
    const err = LexwareErrorMapper.mapError(406, {
      i18nKey: 'completely_new_future_lexware_key',
      message: 'Unmapped domain rule violation',
    });

    expect(err).toBeInstanceOf(LexwareValidationError);
    const valErr = err as LexwareValidationError;
    expect(valErr.i18nKey).toBe('completely_new_future_lexware_key');
    expect(valErr.isRetryable).toBe(false);
    expect(valErr.message).toContain('completely_new_future_lexware_key');
  });

  it('maps HTTP 409 to LexwareVersionConflictError', () => {
    const err = LexwareErrorMapper.mapError(409, {
      message: 'Version conflict',
      traceId: 'trace-conflict-1',
    });

    expect(err).toBeInstanceOf(LexwareVersionConflictError);
    expect((err as LexwareVersionConflictError).statusCode).toBe(409);
    expect(err.message).toContain('Sürüm çakışması');
  });

  it('maps HTTP 429 to AccountingRateLimitError', () => {
    const err = LexwareErrorMapper.mapError(429, {});
    expect(err).toBeInstanceOf(AccountingRateLimitError);
  });

  it('maps HTTP 401/403 to AccountingAuthError', () => {
    const err401 = LexwareErrorMapper.mapError(401, { message: 'Unauthorized' });
    expect(err401).toBeInstanceOf(AccountingAuthError);

    const err403 = LexwareErrorMapper.mapError(403, { message: 'Forbidden' });
    expect(err403).toBeInstanceOf(AccountingAuthError);
  });
});
