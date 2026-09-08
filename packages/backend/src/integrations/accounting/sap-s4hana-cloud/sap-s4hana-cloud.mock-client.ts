import * as fs from 'fs';
import * as path from 'path';
import {
  AccountingAuthError,
  AccountingNetworkError,
  AccountingRateLimitError,
} from '../core/AccountingErrors';
import { ISapS4HanaCloudClient } from './sap-s4hana-cloud.client';
import {
  SapBusinessPartner,
  SapFindContactQuery,
  SapS4HanaCloudCredentials,
} from './sap-s4hana-cloud.types';

export class SapS4HanaCloudMockClient implements ISapS4HanaCloudClient {
  private readonly fixtures: SapBusinessPartner[] = [];

  constructor(private readonly credentials?: SapS4HanaCloudCredentials) {
    try {
      const fixturePath = path.join(__dirname, '__fixtures__', 'business-partners.fixture.json');
      if (fs.existsSync(fixturePath)) {
        const raw = fs.readFileSync(fixturePath, 'utf-8');
        const parsed = JSON.parse(raw);
        this.fixtures = parsed.d?.results || [];
      }
    } catch {
      this.fixtures = [];
    }
  }

  private checkTriggers() {
    const key = this.credentials?.apiKey || this.credentials?.password || '';
    if (key.includes('TRIGGER_AUTH_FAIL')) {
      throw new AccountingAuthError('SAP_S4HANA_CLOUD', 'Mock SAP auth failure (401)');
    }
    if (key.includes('TRIGGER_RATE_LIMIT')) {
      throw new AccountingRateLimitError('SAP_S4HANA_CLOUD');
    }
    if (key.includes('TRIGGER_NETWORK_FAIL')) {
      throw new AccountingNetworkError('SAP_S4HANA_CLOUD', 'Mock SAP network connection failed (500)');
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string; companyName?: string }> {
    this.checkTriggers();
    return {
      success: true,
      message: 'SAP S/4HANA Cloud mock bağlantısı başarılı (örnek veri)',
      companyName: 'SAP S/4HANA Cloud (Mock Sandbox)',
    };
  }

  async getBusinessPartners(
    query: SapFindContactQuery,
  ): Promise<{ results: SapBusinessPartner[]; totalCount?: number }> {
    this.checkTriggers();

    let filtered = [...this.fixtures];

    if (query.businessPartnerId) {
      filtered = filtered.filter((bp) => bp.BusinessPartner === query.businessPartnerId);
    }

    if (query.searchTerm) {
      const term = query.searchTerm.toLowerCase();
      filtered = filtered.filter(
        (bp) =>
          bp.SearchTerm1?.toLowerCase().includes(term) ||
          bp.SearchTerm2?.toLowerCase().includes(term) ||
          bp.BusinessPartnerFullName?.toLowerCase().includes(term) ||
          bp.BusinessPartner.includes(term),
      );
    }

    if (query.taxNumber) {
      filtered = filtered.filter((bp) =>
        bp.to_BusinessPartnerTaxNumber?.results?.some((t) => t.BPTaxNumber === query.taxNumber),
      );
    }

    const totalCount = filtered.length;
    const skip = query.skip || 0;
    const top = query.top || 20;

    const results = filtered.slice(skip, skip + top);

    return { results, totalCount };
  }

  async getBusinessPartnerById(id: string): Promise<SapBusinessPartner | null> {
    this.checkTriggers();
    const found = this.fixtures.find((bp) => bp.BusinessPartner === id);
    return found || null;
  }
}
