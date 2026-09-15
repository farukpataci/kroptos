import {
  AccountingApiError,
  AccountingAuthError,
  AccountingNetworkError,
  ClosedPeriodError,
  PostingDefaultsMissingError,
  SessionLimitReachedError,
} from '../core/AccountingErrors';
import { ProblemCode } from '../core/agent/AgentProtocol';

/**
 * docs/nebim.v3.agent.md §5 (K14, K18), §6.
 * Dönem, lisans ve oturum hataları AYRI sınıflara eşlenir; bilinmeyen hata olarak geçiştirilmez.
 */
export class NebimV3ErrorMapper {
  static fromAgentError(errorCode: string | undefined, errorRaw?: string): Error {
    const code = (errorCode ?? '') as ProblemCode | '';
    const raw = errorRaw ?? '';

    // K18: Nebim'de ERP_ENFORCED — ERP'nin dönem / kapalı hesap hatası ClosedPeriodError'a eşlenir
    if (NebimV3ErrorMapper.isClosedPeriodError(raw)) {
      return new ClosedPeriodError('ERP_ENFORCED', raw);
    }

    switch (code) {
      case 'erp_session_limit':
        return new SessionLimitReachedError('NEBIM-V3', 1);
      case 'posting_defaults_missing':
        return new PostingDefaultsMissingError('NEBIM-V3', [raw || 'storeCode']);
      case 'erp_auth_failed':
        return new AccountingAuthError('NEBIM-V3', raw || 'Nebim V3 kimlik doğrulama hatası');
      case 'agent_offline':
      case 'job_expired':
        return new AccountingNetworkError('NEBIM-V3', `${code}: ${raw}`.trim());
      default:
        return new AccountingApiError('NEBIM-V3', 502, `${code || 'erp_error'}: ${raw}`.trim());
    }
  }

  static isClosedPeriodError(msg: string): boolean {
    return /kapanm[ıi][şs]|closed period|period closed|muhasebe d[öo]nemi|d[öo]nem kapal[ıi]/i.test(msg);
  }
}
