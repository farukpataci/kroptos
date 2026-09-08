export type AccountingEnvironment = 'MOCK' | 'TEST' | 'PRODUCTION';
export type AccountingReadiness = 'SCAFFOLDED' | 'MOCK_READY' | 'TEST_READY' | 'PRODUCTION_READY';

export interface AccountingCompanyItem {
  id: string;
  integrationId: string;
  agencyId: string;
  externalCompanyId: string;
  name?: string;
  currency: string;
  isDefault: boolean;
  invoiceSeries?: string;
  defaultAccountCodes?: Record<string, any>;
  createdAt: string;
}

export interface AccountingIntegrationItem {
  id: string;
  publicId: string;
  agencyId: string;
  clientId?: string;
  storeId?: string;
  provider: string;
  name: string;
  environment: AccountingEnvironment;
  status: 'connected' | 'disconnected' | 'error';
  readiness: AccountingReadiness;
  credentials?: Record<string, any>;
  scopeKey: string;
  lastVerifiedAt?: string;
  lastSyncAt?: string;
  lastErrorMessage?: string;
  companies?: AccountingCompanyItem[];
  createdAt: string;
}

export interface AccountingDocumentItem {
  id: string;
  agencyId: string;
  clientId?: string;
  storeId: string;
  integrationId: string;
  companyId: string;
  type: 'sales_invoice' | 'payment' | 'purchase_invoice';
  referenceCode: string;
  status: 'pending' | 'created' | 'failed' | 'cancelled';
  externalId?: string;
  externalNumber?: string;
  totalAmount: number | string;
  currency: string;
  isTestMode: boolean;
  errorMessage?: string;
  rawResponse?: any;
  createdAt: string;
  updatedAt: string;
}

export interface AccountingContactMappingItem {
  id: string;
  companyId: string;
  kroptosKey: string;
  externalContactId: string;
  displayName?: string;
  taxNumber?: string;
  status: 'matched' | 'unmatched';
  createdAt: string;
}

export interface AccountingProductMappingItem {
  id: string;
  companyId: string;
  productSku: string;
  externalProductId: string;
  externalCode?: string;
  externalName?: string;
  status: 'matched' | 'unmatched';
  createdAt: string;
}
