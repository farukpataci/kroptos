import { IntegrationNotVerifiedError } from '../core/AccountingErrors';
import { INetSuiteClient } from './netsuite.invoice-flow';
import { NetSuiteMetadataCatalogSchema } from './netsuite.types';

/**
 * NetSuite TEST İstemcisi (§1, §6, §10)
 * Bu turda MOCK_READY hedeflendiği için TEST ortamında hiçbir gerçek ağ çağrısı yapılmaz.
 */
export class NetSuiteTestClient implements INetSuiteClient {
  private guard(): never {
    throw new IntegrationNotVerifiedError('netsuite', 'TEST');
  }

  async testConnection(): Promise<any> {
    this.guard();
  }

  async getMetadataCatalog(_recordType: string): Promise<NetSuiteMetadataCatalogSchema> {
    this.guard();
  }

  async upsertInvoice(_externalId: string, _payload: any): Promise<any> {
    this.guard();
  }

  async getInvoice(_idOrExternalId: string | number): Promise<any> {
    this.guard();
  }

  async upsertCustomer(_externalId: string, _payload: any): Promise<any> {
    this.guard();
  }

  async getCustomer(_idOrExternalId: string | number): Promise<any> {
    this.guard();
  }

  async createPayment(_payload: any): Promise<any> {
    this.guard();
  }

  async createItem(_payload: any): Promise<any> {
    this.guard();
  }

  async getItem(_idOrExternalId: string | number): Promise<any> {
    this.guard();
  }

  async voidInvoice(_idOrExternalId: string | number): Promise<any> {
    this.guard();
  }
}
