import { SapBusinessPartner, SapFindContactQuery } from './sap-s4hana-cloud.types';

export interface ISapS4HanaCloudClient {
  testConnection(): Promise<{ success: boolean; message: string; companyName?: string }>;
  getBusinessPartners(
    query: SapFindContactQuery,
  ): Promise<{ results: SapBusinessPartner[]; totalCount?: number }>;
  getBusinessPartnerById(id: string): Promise<SapBusinessPartner | null>;
}
