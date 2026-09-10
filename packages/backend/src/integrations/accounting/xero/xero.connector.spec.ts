import {
  AccountingAmountMismatchError,
  AccountingAuthError,
  AccountingInvoiceRequest,
  AccountingRateLimitExceededError,
  CapabilityStatus,
  IntegrationNotVerifiedError,
} from '../core';
import { XeroConnector } from './xero.connector';
import { XeroErrorMapper } from './xero.error-mapper';
import { XeroStatusMapper } from './xero.status-mapper';
import { XERO_DESCRIPTOR } from './xero.descriptor';

describe('XeroConnector (MOCK_READY)', () => {
  const mockCredentials = {
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    tenantId: 'xero-tenant-uuid-demo-org',
    accountCode: '200',
    bankAccountCode: '090',
  };

  const sampleInvoiceRequest: AccountingInvoiceRequest = {
    companyId: 'comp-101',
    referenceCode: 'INV-XERO-2026',
    issueDate: '2026-09-10',
    dueDate: '2026-09-24',
    currency: 'GBP',
    contact: {
      name: 'Global Corp Ltd',
      email: 'jane@globalcorp.com',
      taxNumber: 'GB123456789',
    },
    items: [
      {
        sku: 'SKU-DEMO-01',
        name: 'Demo Product 1',
        quantity: 1,
        unitPrice: 100.0,
        vatRate: 20,
        vatAmount: 20.0,
        totalAmount: 120.0,
      },
    ],
    subtotal: 100.0,
    vatTotal: 20.0,
    grandTotal: 120.0,
  };

  describe('1. testConnection', () => {
    it('returns success in MOCK environment with valid credentials', async () => {
      const connector = new XeroConnector(mockCredentials, 'MOCK');
      const res = await connector.testConnection();

      expect(res.success).toBe(true);
      expect(res.companyName).toBe('KroptOS Demo Global Ltd');
      expect(res.companyId).toBe('xero-tenant-uuid-demo-org');
      expect(res.environment).toBe('MOCK');
    });

    it('returns failure in MOCK environment with invalid credentials', async () => {
      const connector = new XeroConnector({ clientId: 'invalid' }, 'MOCK');
      const res = await connector.testConnection();

      expect(res.success).toBe(false);
      expect(res.message).toContain('Invalid Xero credentials');
    });

    it('throws IntegrationNotVerifiedError in TEST environment', async () => {
      const connector = new XeroConnector(mockCredentials, 'TEST');
      await expect(connector.testConnection()).rejects.toThrow(IntegrationNotVerifiedError);
    });

    it('throws IntegrationNotVerifiedError in PRODUCTION environment', async () => {
      const connector = new XeroConnector(mockCredentials, 'PRODUCTION');
      await expect(connector.testConnection()).rejects.toThrow(IntegrationNotVerifiedError);
    });
  });

  describe('2. createInvoice & Idempotency', () => {
    it('creates invoice, reconciles amounts, and returns externalId', async () => {
      const connector = new XeroConnector(mockCredentials, 'MOCK');
      const res = await connector.createInvoice(sampleInvoiceRequest);

      expect(res.externalId).toBeDefined();
      expect(res.externalNumber).toBeDefined();
      expect(res.rawResponse?.Status).toBe('AUTHORISED');
    });

    it('is idempotent on duplicate referenceCode', async () => {
      const connector = new XeroConnector(mockCredentials, 'MOCK');
      const first = await connector.createInvoice(sampleInvoiceRequest);
      const second = await connector.createInvoice(sampleInvoiceRequest);

      expect(second.externalId).toBe(first.externalId);
      expect(second.externalNumber).toBe(first.externalNumber);
    });

    it('throws AccountingAmountMismatchError if grandTotal does not reconcile', async () => {
      const connector = new XeroConnector(mockCredentials, 'MOCK');
      const invalidReq: AccountingInvoiceRequest = {
        ...sampleInvoiceRequest,
        referenceCode: 'INV-MISMATCH-1',
        grandTotal: 999.99, // Mismatched vs items (120.00)
      };

      await expect(connector.createInvoice(invalidReq)).rejects.toThrow(
        AccountingAmountMismatchError,
      );
    });
  });

  describe('3. syncContact, recordPayment, mapProduct', () => {
    it('syncContact creates customer contact', async () => {
      const connector = new XeroConnector(mockCredentials, 'MOCK');
      const res = await connector.syncContact({
        companyId: 'comp-101',
        kroptosKey: 'CUST-NEW-01',
        name: 'New Global Customer Ltd',
        taxNumber: 'GB999888777',
      });

      expect(res.externalId).toBeDefined();
    });

    it('recordPayment records payment for invoice', async () => {
      const connector = new XeroConnector(mockCredentials, 'MOCK');
      const res = await connector.recordPayment({
        companyId: 'comp-101',
        invoiceExternalId: 'inv-001-uuid',
        referenceCode: 'PAY-REF-01',
        amount: 120.0,
        currency: 'GBP',
        paymentDate: '2026-09-10',
      });

      expect(res.externalId).toBeDefined();
    });

    it('mapProduct maps SKU to Xero Item', async () => {
      const connector = new XeroConnector(mockCredentials, 'MOCK');
      const res = await connector.mapProduct({
        companyId: 'comp-101',
        sku: 'SKU-NEW-01',
        name: 'New Product Item',
        vatRate: 20,
        unitPrice: 49.99,
      });

      expect(res.externalId).toBeDefined();
      expect(res.code).toBe('SKU-NEW-01');
    });
  });

  describe('4. Status & Error Mappers', () => {
    it('maps Xero statuses correctly', () => {
      expect(XeroStatusMapper.toKroptosStatus('DRAFT')).toBe('pending');
      expect(XeroStatusMapper.toKroptosStatus('SUBMITTED')).toBe('pending');
      expect(XeroStatusMapper.toKroptosStatus('AUTHORISED')).toBe('sent');
      expect(XeroStatusMapper.toKroptosStatus('PAID')).toBe('sent');
      expect(XeroStatusMapper.toKroptosStatus('VOIDED')).toBe('cancelled');
      expect(XeroStatusMapper.toKroptosStatus('DELETED')).toBe('cancelled');
      expect(XeroStatusMapper.toKroptosStatus('UNKNOWN_STATUS')).toBe('pending');
      expect(XeroStatusMapper.toKroptosStatus(null)).toBe('pending');
    });

    it('detects inline Xero errors and maps status codes', () => {
      const inlineErrorBody = {
        Status: 'ERROR',
        ValidationErrors: [{ Message: 'Account code is inactive' }],
      };
      expect(XeroErrorMapper.hasInlineError(inlineErrorBody)).toBe(true);

      const parsed429 = XeroErrorMapper.parseResponse(
        429,
        { Message: 'Rate limit exceeded' },
        new Headers({ 'retry-after': '30' }),
      );
      expect(XeroErrorMapper.toDomainError(parsed429)).toBeInstanceOf(
        AccountingRateLimitExceededError,
      );

      const parsed401 = XeroErrorMapper.parseResponse(401, { Message: 'Unauthorized' });
      expect(XeroErrorMapper.toDomainError(parsed401)).toBeInstanceOf(AccountingAuthError);
    });
  });

  describe('5. Capabilities & Registration', () => {
    it('declares expected capabilities and semantics in descriptor', () => {
      expect(XERO_DESCRIPTOR.capabilities.stockSync).toBe(CapabilityStatus.NOT_SUPPORTED);
      expect(XERO_DESCRIPTOR.capabilities.salesInvoice).toBe(CapabilityStatus.MOCK_ONLY);
      expect(XERO_DESCRIPTOR.capabilities.refreshSemantics).toEqual({
        rotatesOnRefresh: true,
        previousTokenGraceMs: 1_800_000,
        inactivityLimitDays: 60,
      });
    });
  });
});
