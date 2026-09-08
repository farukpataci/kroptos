import {
  AccountingApiError,
  AccountingAuthError,
  AccountingNetworkError,
  AccountingRateLimitError,
} from '../core/AccountingErrors';
import { SapODataHelper } from './sap-s4hana-cloud.odata';

export class SapS4HanaCloudErrorMapper {
  static mapHttpError(status: number, data?: any, originalMessage?: string): Error {
    const odataMsg = SapODataHelper.parseODataError(data);
    const detailMsg = odataMsg || originalMessage || `SAP API error with status ${status}`;

    // Mask any accidental API key or credentials in message
    const safeMsg = detailMsg.replace(/APIKey:[^\s]+/gi, 'APIKey:***');

    if (status === 401 || status === 403) {
      return new AccountingAuthError('SAP_S4HANA_CLOUD', `SAP kimlik doğrulama hatası (${status}): ${safeMsg}`);
    }

    if (status === 429) {
      return new AccountingRateLimitError('SAP_S4HANA_CLOUD');
    }

    if (status >= 500) {
      return new AccountingNetworkError('SAP_S4HANA_CLOUD', `SAP sunucu hatası (${status}): ${safeMsg}`);
    }

    return new AccountingApiError('SAP_S4HANA_CLOUD', status, safeMsg, data);
  }

  static checkODataResponse(data: any): void {
    const odataMsg = SapODataHelper.parseODataError(data);
    if (odataMsg) {
      throw new AccountingApiError('SAP_S4HANA_CLOUD', 400, `SAP OData hatası: ${odataMsg}`, data);
    }
  }
}
