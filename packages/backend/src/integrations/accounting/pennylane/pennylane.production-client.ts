import { IntegrationNotVerifiedError } from '../core/AccountingErrors';
import { IPennylaneClient } from './pennylane.client';
import {
  PennylaneCreateInvoiceRequest,
  PennylaneCustomerRequest,
  PennylaneCustomerResponse,
  PennylaneInvoiceResponse,
  PennylaneListResponse,
  PennylaneProductRequest,
  PennylaneProductResponse,
} from './pennylane.types';

/**
 * Pennylane PRODUCTION İstemcisi (§1)
 *
 * Canlı ağ çağrısı yapmaz. MOCK_READY aşamasında korumalıdır.
 */
export class PennylaneProductionClient implements IPennylaneClient {
  constructor(private readonly _credentials?: any) {}

  async createCustomer(_data: PennylaneCustomerRequest): Promise<PennylaneCustomerResponse> {
    throw new IntegrationNotVerifiedError('PENNYLANE', 'PRODUCTION');
  }

  async getCustomer(_id: number): Promise<PennylaneCustomerResponse> {
    throw new IntegrationNotVerifiedError('PENNYLANE', 'PRODUCTION');
  }

  async findCustomerByExternalReference(_ref: string): Promise<PennylaneCustomerResponse | null> {
    throw new IntegrationNotVerifiedError('PENNYLANE', 'PRODUCTION');
  }

  async createInvoice(_data: PennylaneCreateInvoiceRequest): Promise<PennylaneInvoiceResponse> {
    throw new IntegrationNotVerifiedError('PENNYLANE', 'PRODUCTION');
  }

  async getInvoice(_id: number): Promise<PennylaneInvoiceResponse> {
    throw new IntegrationNotVerifiedError('PENNYLANE', 'PRODUCTION');
  }

  async findInvoiceByExternalReference(_ref: string): Promise<PennylaneInvoiceResponse | null> {
    throw new IntegrationNotVerifiedError('PENNYLANE', 'PRODUCTION');
  }

  async finalizeInvoice(_id: number): Promise<PennylaneInvoiceResponse> {
    throw new IntegrationNotVerifiedError('PENNYLANE', 'PRODUCTION');
  }

  async deleteDraftInvoice(_id: number): Promise<void> {
    throw new IntegrationNotVerifiedError('PENNYLANE', 'PRODUCTION');
  }

  async createProduct(_data: PennylaneProductRequest): Promise<PennylaneProductResponse> {
    throw new IntegrationNotVerifiedError('PENNYLANE', 'PRODUCTION');
  }

  async listInvoices(_cursor?: string, _limit?: number): Promise<PennylaneListResponse<PennylaneInvoiceResponse>> {
    throw new IntegrationNotVerifiedError('PENNYLANE', 'PRODUCTION');
  }
}
