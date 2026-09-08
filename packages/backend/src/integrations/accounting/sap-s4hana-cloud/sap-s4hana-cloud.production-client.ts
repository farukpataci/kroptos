import { IntegrationNotVerifiedError } from '../core/AccountingErrors';
import { ISapS4HanaCloudClient } from './sap-s4hana-cloud.client';
import { SapBusinessPartner, SapFindContactQuery } from './sap-s4hana-cloud.types';

export class SapS4HanaCloudProductionClient implements ISapS4HanaCloudClient {
  async testConnection(): Promise<never> {
    throw new IntegrationNotVerifiedError('SAP_S4HANA_CLOUD', 'PRODUCTION');
  }

  async getBusinessPartners(_query: SapFindContactQuery): Promise<never> {
    throw new IntegrationNotVerifiedError('SAP_S4HANA_CLOUD', 'PRODUCTION');
  }

  async getBusinessPartnerById(_id: string): Promise<never> {
    throw new IntegrationNotVerifiedError('SAP_S4HANA_CLOUD', 'PRODUCTION');
  }
}
