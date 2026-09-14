import { AccountingApiError, AccountingAuthError, AccountingNetworkError } from '../core/AccountingErrors';
import { ProblemCode } from '../core/agent/AgentProtocol';

/**
 * Hata kodu sözlüğü DOĞRULANMADI (§3.2). Yalnızca dokümandaki tek metin ("Geçersiz api key")
 * ve Agent'ın normalize ettiği problem kodları eşlenir; gerisi ham mesajla API hatasıdır.
 */
export class MikroErrorMapper {
  static fromAgentError(errorCode: string | undefined, errorRaw?: string): Error {
    const code = (errorCode ?? '') as ProblemCode | '';
    switch (code) {
      case 'erp_auth_failed':
        return new AccountingAuthError('MIKRO', errorRaw || 'Geçersiz api key / kimlik reddedildi');
      case 'erp_clock_skew':
        return new AccountingApiError('MIKRO', 409, `Saat farkı — iş çalıştırılmadı. ${errorRaw ?? ''}`.trim());
      case 'agent_offline':
      case 'job_expired':
        return new AccountingNetworkError('MIKRO', `${code}: ${errorRaw ?? ''}`.trim());
      default:
        return new AccountingApiError('MIKRO', 502, `${code || 'erp_error'}: ${errorRaw ?? ''}`.trim());
    }
  }

  static isInvalidApiKeyText(text: string | undefined): boolean {
    return !!text && /Ge[cç]ersiz api key/i.test(text);
  }
}
