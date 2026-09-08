import { IntegrationNotVerifiedError } from '../core/AccountingErrors';
import { ISapS4HanaCloudClient } from './sap-s4hana-cloud.client';
import { SapBusinessPartner, SapFindContactQuery } from './sap-s4hana-cloud.types';

export class SapS4HanaCloudTestClient implements ISapS4HanaCloudClient {
  async testConnection(): Promise<never> {
    throw new IntegrationNotVerifiedError('SAP_S4HANA_CLOUD', 'TEST');
  }

  async getBusinessPartners(_query: SapFindContactQuery): Promise<never> {
    throw new IntegrationNotVerifiedError('SAP_S4HANA_CLOUD', 'TEST');
  }

  async getBusinessPartnerById(_id: string): Promise<never> {
    throw new IntegrationNotVerifiedError('SAP_S4HANA_CLOUD', 'TEST');
  }
}
