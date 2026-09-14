import { AccountingEnvironment, CapabilityStatus } from './AccountingTypes';
import {
  CapabilityContractRequiredError,
  CapabilityNotSupportedError,
  IntegrationNotVerifiedError,
} from './AccountingErrors';

/**
 * K3 — sahte başarı yok. Yalnızca SUPPORTED (ve MOCK ortamında MOCK_ONLY) sessizce geçer;
 * diğer her statü fırlatır. Hiçbir dal bir "başarı" değeri döndürmez.
 */
export function assertCapability(
  provider: string,
  capability: string,
  status: CapabilityStatus | undefined,
  environment: AccountingEnvironment,
): void {
  switch (status) {
    case CapabilityStatus.SUPPORTED:
      return;
    case CapabilityStatus.MOCK_ONLY:
      if (environment === 'MOCK') return;
      throw new IntegrationNotVerifiedError(provider, environment);
    case CapabilityStatus.NOT_SUPPORTED:
      throw new CapabilityNotSupportedError(provider, capability);
    case CapabilityStatus.CONTRACT_REQUIRED:
      throw new CapabilityContractRequiredError(provider, capability);
    case CapabilityStatus.DOCUMENTATION_REQUIRED:
    case CapabilityStatus.UNKNOWN:
    default:
      throw new IntegrationNotVerifiedError(
        provider,
        `${environment} (${capability}: ${status ?? 'undefined'})`,
      );
  }
}

/** K11: otomatik fatura yazma yalnızca geri okunabilen ERP'de açılır; aksi hâlde onaylı mod. */
export function canAutoPushInvoice(
  findByRefStatus: CapabilityStatus | undefined,
  environment: AccountingEnvironment,
): boolean {
  return (
    findByRefStatus === CapabilityStatus.SUPPORTED ||
    (environment === 'MOCK' && findByRefStatus === CapabilityStatus.MOCK_ONLY)
  );
}
