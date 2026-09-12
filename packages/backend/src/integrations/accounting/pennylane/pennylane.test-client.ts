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
 * Pennylane TEST İstemcisi (§1)
 *
 * Canlı ağ çağrısı yapmaz. MOCK_READY aşamasında korumalıdır.
 */
export class PennylaneTestClient implements IPennylaneClient {
  constructor(private readonly _credentials?: any) {}

  async createCustomer(_data: PennylaneCustomerRequest): Promise<PennylaneCustomerResponse> {
    throw new IntegrationNotVerifiedError('PENNYLANE', 'TEST');
  }

  async getCustomer(_id: number): Promise<PennylaneCustomerResponse> {
    throw new IntegrationNotVerifiedError('PENNYLANE', 'TEST');
  }

  async findCustomerByExternalReference(_ref: string): Promise<PennylaneCustomerResponse | null> {
    throw new IntegrationNotVerifiedError('PENNYLANE', 'TEST');
  }

  async createInvoice(_data: PennylaneCreateInvoiceRequest): Promise<PennylaneInvoiceResponse> {
    throw new IntegrationNotVerifiedError('PENNYLANE', 'TEST');
  }

  async getInvoice(_id: number): Promise<PennylaneInvoiceResponse> {
    throw new IntegrationNotVerifiedError('PENNYLANE', 'TEST');
  }

  async findInvoiceByExternalReference(_ref: string): Promise<PennylaneInvoiceResponse | null> {
    throw new IntegrationNotVerifiedError('PENNYLANE', 'TEST');
  }

  async finalizeInvoice(_id: number): Promise<PennylaneInvoiceResponse> {
    throw new IntegrationNotVerifiedError('PENNYLANE', 'TEST');
  }

  async deleteDraftInvoice(_id: number): Promise<void> {
    throw new IntegrationNotVerifiedError('PENNYLANE', 'TEST');
  }

  async createProduct(_data: PennylaneProductRequest): Promise<PennylaneProductResponse> {
    throw new IntegrationNotVerifiedError('PENNYLANE', 'TEST');
  }

  async listInvoices(_cursor?: string, _limit?: number): Promise<PennylaneListResponse<PennylaneInvoiceResponse>> {
    throw new IntegrationNotVerifiedError('PENNYLANE', 'TEST');
  }
}
