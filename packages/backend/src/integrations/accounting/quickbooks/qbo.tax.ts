import { AccountingApiError } from '../core/AccountingErrors';
import { QBOPreferences } from './qbo.types';

export interface QBOTaxConfiguration {
  automaticSalesTax: boolean; // PartnerTaxEnabled === true
  usingSalesTax: boolean;
  defaultTaxCodeRef?: string;
}

export class QBOTaxManager {
  /**
   * §4.6 Detects tax model from QuickBooks Preferences entity.
   * If AST (PartnerTaxEnabled) is active, QuickBooks calculates sales tax automatically
   * based on addresses; TxnTaxDetail MUST NOT be sent.
   */
  static determineTaxConfig(
    prefs: QBOPreferences | null | undefined,
    configuredTaxCodeRef?: string,
  ): QBOTaxConfiguration {
    if (!prefs || !prefs.TaxPrefs) {
      throw new AccountingApiError(
        'quickbooks',
        400,
        'QuickBooks Online vergi tercihleri (Preferences.TaxPrefs) tespit edilemedi. Fatura gönderimi durduruldu.',
      );
    }

    const usingSalesTax = prefs.TaxPrefs.UsingSalesTax ?? true;
    const partnerTaxEnabled = prefs.TaxPrefs.PartnerTaxEnabled ?? false;

    return {
      automaticSalesTax: partnerTaxEnabled,
      usingSalesTax,
      defaultTaxCodeRef: configuredTaxCodeRef || (partnerTaxEnabled ? 'TAX' : 'NON'),
    };
  }

  /**
   * Evaluates line-level TaxCodeRef according to AST status.
   * In AST mode: only 'TAX' (taxable) or 'NON' (non-taxable) is accepted.
   */
  static resolveLineTaxCode(
    taxConfig: QBOTaxConfiguration,
    vatRate: number,
  ): { value: string } | undefined {
    if (!taxConfig.usingSalesTax) {
      return undefined;
    }

    if (taxConfig.automaticSalesTax) {
      // In AST mode: 'TAX' if rate > 0, else 'NON'
      return { value: vatRate > 0 ? 'TAX' : 'NON' };
    }

    // In non-AST mode, use configured code (e.g. standard rate reference)
    return { value: taxConfig.defaultTaxCodeRef || (vatRate > 0 ? 'TAX' : 'NON') };
  }
}
