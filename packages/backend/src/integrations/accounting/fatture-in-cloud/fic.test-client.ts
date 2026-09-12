/**
 * Fatture in Cloud (TeamSystem) TEST Client
 *
 * CRITICAL RULE (§1, §6, §10):
 * In MOCK_READY phase, no real network requests are permitted.
 * Calling any method on TestClient throws IntegrationNotVerifiedError.
 */

import { IntegrationNotVerifiedError } from '../core/AccountingErrors';
import { FIC_PROVIDER_NAME } from './fic.types';

export class FicTestClient {
  private guard(): never {
    throw new IntegrationNotVerifiedError(FIC_PROVIDER_NAME, 'TEST');
  }

  async getUserCompanies(): Promise<any> {
    this.guard();
  }

  async createIssuedDocument(_companyId: any, _payload: any): Promise<any> {
    this.guard();
  }

  async getIssuedDocument(_companyId: any, _documentId: any, _detailed?: boolean): Promise<any> {
    this.guard();
  }

  async verifyEInvoiceXml(_companyId: any, _documentId: any): Promise<any> {
    this.guard();
  }

  async getNewIssuedDocumentTotals(_companyId: any, _request: any): Promise<any> {
    this.guard();
  }

  async listIssuedDocuments(_companyId: any, _params?: any): Promise<any> {
    this.guard();
  }
}
