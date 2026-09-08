/**
 * BizimHesap Response Mapper
 * Source: https://apidocs.bizimhesap.com (2026-09)
 */

import { AccountingInvoiceResult } from '../core/AccountingTypes';
import { BizimhesapApiResponse } from './bizimhesap.types';

export class BizimhesapResponseMapper {
  static toInvoiceResult(
    response: BizimhesapApiResponse,
    invoiceNo?: string,
  ): AccountingInvoiceResult {
    return {
      externalId: response.guid,
      externalNumber: invoiceNo,
      rawResponse: response,
    };
  }
}
