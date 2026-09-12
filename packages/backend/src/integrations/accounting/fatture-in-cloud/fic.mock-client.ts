/**
 * Fatture in Cloud (TeamSystem) Mock Client
 * Reference: §7 Mock Senaryoları
 *
 * Simulates all FIC API endpoints completely in memory with zero network calls.
 */

import { BadRequestException } from '@nestjs/common';
import { AccountingRateLimitError } from '../core/AccountingErrors';
import {
  FIC_PROVIDER_NAME,
  FicIssuedDocumentPayload,
  FicIssuedDocumentResponse,
  FicTotalsCalculationRequest,
  FicTotalsCalculationResponse,
  FicUserCompaniesResponse,
  FicXmlVerifyResponse,
} from './fic.types';
import { roundToTwoDecimals } from './fic.prices';

export interface FicMockScenarioOptions {
  shouldFailValidation?: boolean;
  validationErrorMessage?: string;
  simulateRateLimit?: boolean;
  simulateTimeout?: boolean;
  initialEiStatus?: string;
}

export class FicMockClient {
  private documents: Map<number, FicIssuedDocumentResponse> = new Map();
  private nextId = 10001;
  private nextNumber = 1;
  private scenarioOptions: FicMockScenarioOptions = {};

  constructor(options: FicMockScenarioOptions = {}) {
    this.scenarioOptions = options;
  }

  setScenario(options: FicMockScenarioOptions): void {
    this.scenarioOptions = { ...this.scenarioOptions, ...options };
  }

  /**
   * Mock GET /user/companies
   */
  async getUserCompanies(): Promise<FicUserCompaniesResponse> {
    if (this.scenarioOptions.simulateRateLimit) {
      throw new AccountingRateLimitError(
        FIC_PROVIDER_NAME,
        60,
      );
    }

    return {
      data: {
        companies: [
          {
            id: 12345,
            name: 'KroptOS Demo S.r.l.',
            tax_code: 'IT12345678901',
            type: 'company',
          },
        ],
      },
    };
  }

  /**
   * Mock POST /c/{company_id}/issued_documents
   */
  async createIssuedDocument(
    companyId: string | number,
    payload: FicIssuedDocumentPayload,
  ): Promise<{ data: FicIssuedDocumentResponse }> {
    if (this.scenarioOptions.simulateTimeout) {
      throw new Error('Fatture in Cloud istek zaman aşımına uğradı (ETIMEDOUT)');
    }

    if (this.scenarioOptions.simulateRateLimit) {
      throw new AccountingRateLimitError(
        FIC_PROVIDER_NAME,
        60,
      );
    }

    // Validate mandatory payload properties
    if (!payload.entity || !payload.entity.name) {
      throw new BadRequestException('Müşteri bilgisi (entity.name) eksik.');
    }

    if (!payload.items_list || payload.items_list.length === 0) {
      throw new BadRequestException('Fatura kalemleri (items_list) boş olamaz.');
    }

    const docId = this.nextId++;
    const docNumber = this.nextNumber++;

    let totalNet = 0;
    let totalGross = 0;
    for (const item of payload.items_list) {
      const net = item.net_price ?? roundToTwoDecimals((item.gross_price || 0) / 1.22);
      const gross = item.gross_price ?? roundToTwoDecimals(net * (1 + (item.vat?.value || 0) / 100));
      totalNet += net * item.qty;
      totalGross += gross * item.qty;
    }

    totalNet = roundToTwoDecimals(totalNet);
    totalGross = roundToTwoDecimals(totalGross);
    const totalVat = roundToTwoDecimals(totalGross - totalNet);

    const eiStatus = this.scenarioOptions.initialEiStatus || (payload.e_invoice ? 'not_sent' : undefined);

    const created: FicIssuedDocumentResponse = {
      id: docId,
      type: payload.type,
      entity: payload.entity,
      date: payload.date,
      number: docNumber,
      numeration: payload.numeration || 'INV',
      amount_net: totalNet,
      amount_vat: totalVat,
      amount_gross: totalGross,
      use_gross_prices: payload.use_gross_prices ?? false,
      e_invoice: payload.e_invoice ?? false,
      ei_status: eiStatus,
      ei_data: payload.ei_data,
      items_list: payload.items_list,
      payments_list: payload.payments_list || [],
      notes: payload.notes,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.documents.set(docId, created);
    return { data: created };
  }

  /**
   * Mock GET /c/{company_id}/issued_documents/{document_id}
   */
  async getIssuedDocument(
    _companyId: string | number,
    documentId: string | number,
    _detailed: boolean = true,
  ): Promise<{ data: FicIssuedDocumentResponse }> {
    const id = typeof documentId === 'string' ? parseInt(documentId, 10) : documentId;
    const doc = this.documents.get(id);
    if (!doc) {
      throw new BadRequestException(`Belge bulunamadı: ${documentId}`);
    }
    return { data: { ...doc } };
  }

  /**
   * Mock GET /c/{company_id}/issued_documents/{document_id}/e_invoice/xml_verify (§5.8)
   */
  async verifyEInvoiceXml(
    _companyId: string | number,
    documentId: string | number,
  ): Promise<FicXmlVerifyResponse> {
    const id = typeof documentId === 'string' ? parseInt(documentId, 10) : documentId;
    const doc = this.documents.get(id);

    if (this.scenarioOptions.shouldFailValidation) {
      return {
        data: {
          success: false,
          error:
            this.scenarioOptions.validationErrorMessage ||
            'E-Fatura XML doğrulama hatası: Codice Fiscale / Partita IVA geçersiz veya alıcı bilgisi eksik.',
        },
      };
    }

    if (!doc?.entity?.vat_number && !doc?.entity?.tax_code) {
      return {
        data: {
          success: false,
          error: 'Alıcı vergi kimlik numarası eksik olduğundan XML oluşturulamaz.',
        },
      };
    }

    return {
      data: {
        success: true,
      },
    };
  }

  /**
   * Mock POST /c/{company_id}/issued_documents/totals
   */
  async getNewIssuedDocumentTotals(
    _companyId: string | number,
    request: FicTotalsCalculationRequest,
  ): Promise<FicTotalsCalculationResponse> {
    let totalNet = 0;
    let totalGross = 0;

    for (const item of request.data.items_list || []) {
      const net = item.net_price ?? roundToTwoDecimals((item.gross_price || 0) / 1.22);
      const gross = item.gross_price ?? roundToTwoDecimals(net * (1 + (item.vat?.value || 0) / 100));
      totalNet += net * item.qty;
      totalGross += gross * item.qty;
    }

    totalNet = roundToTwoDecimals(totalNet);
    totalGross = roundToTwoDecimals(totalGross);
    const totalVat = roundToTwoDecimals(totalGross - totalNet);

    return {
      data: {
        amount_net: totalNet,
        amount_vat: totalVat,
        amount_gross: totalGross,
        amount_due_discount: 0,
      },
    };
  }

  /**
   * Mock List documents
   */
  async listIssuedDocuments(
    _companyId: string | number,
    _params: any = {},
  ): Promise<{ data: FicIssuedDocumentResponse[] }> {
    return { data: Array.from(this.documents.values()) };
  }
}
