import { DatevConnector } from './datev.connector';
import { AccountingProviderRegistry } from '../core/AccountingProviderRegistry';
import './datev.descriptor'; // Ensure auto-registration

describe('DatevConnector', () => {
  const validCredentials = {
    beraterNummer: 1001,
    mandantenNummer: 12345,
    wjBeginn: '2026-01-01',
    sachkontenLaenge: 4,
    kontenrahmen: 'SKR03',
    encoding: 'WINDOWS-1252',
    festschreibung: 0,
  };

  it('is registered in AccountingProviderRegistry', () => {
    expect(AccountingProviderRegistry.has('DATEV')).toBe(true);
    const descriptor = AccountingProviderRegistry.get('DATEV');
    expect(descriptor.id).toBe('DATEV');
    expect(descriptor.displayName).toContain('DATEV');
    expect(descriptor.connectorClass).toBe(DatevConnector);
  });

  describe('testConnection', () => {
    it('returns success: true for valid DATEV configuration', async () => {
      const connector = new DatevConnector(validCredentials);
      const res = await connector.testConnection();

      expect(res.success).toBe(true);
      expect(res.message).toContain('DATEV EXTF yapılandırması doğrulandı');
    });

    it('returns success: false when configuration is invalid', async () => {
      const invalid = { ...validCredentials, beraterNummer: 500 }; // < 1001
      const connector = new DatevConnector(invalid);
      const res = await connector.testConnection();

      expect(res.success).toBe(false);
      expect(res.message).toContain('DATEV Yapılandırma Hatası');
    });
  });

  describe('lifecycle operations', () => {
    let connector: DatevConnector;

    beforeEach(() => {
      connector = new DatevConnector(validCredentials);
    });

    it('createInvoice maps and returns simulated EXTF batch entry', async () => {
      const res = await connector.createInvoice({
        companyId: '12345',
        referenceCode: 'ORD-999',
        issueDate: '2026-01-15',
        currency: 'EUR',
        contact: {
          name: 'Hans Schmidt',
          taxNumber: '10001',
        },
        items: [
          {
            sku: 'SKU-1',
            name: 'Produkt 1',
            quantity: 1,
            unitPrice: 100.0,
            vatRate: 19,
            totalAmount: 119.0,
          },
        ],
        subtotal: 100.0,
        vatTotal: 19.0,
        grandTotal: 119.0,
      });

      expect(res.externalId).toBe('datev_extf_ORD-999');
      expect(res.externalNumber).toBe('ORD-999');
      expect(res.rawResponse?.batchFormat).toBe('EXTF-700-21-13');
      expect(res.rawResponse?.entryCount).toBe(1);
    });

    it('recordPayment returns valid payment entry', async () => {
      const res = await connector.recordPayment({
        companyId: '12345',
        invoiceExternalId: 'RE-2026-001',
        referenceCode: 'PAY-1',
        amount: 119.0,
        currency: 'EUR',
        paymentDate: '2026-01-20',
      });

      expect(res.externalId).toBe('datev_pay_PAY-1');
      expect(res.rawResponse?.entrySummary.umsatz).toBe(119.0);
    });

    it('syncContact returns assigned Debitor number', async () => {
      const res = await connector.syncContact({
        companyId: '12345',
        kroptosKey: 'cust_001',
        name: 'Max Müller',
      });

      expect(res.externalId).toBeDefined();
      expect(res.externalId.length).toBe(5); // sachkontenLaenge 4 + 1
    });

    it('mapProduct returns resolved revenue account', async () => {
      const res = await connector.mapProduct({
        companyId: '12345',
        sku: 'SKU-1',
        name: 'Standard Ware',
      });

      expect(res.externalId).toBe('8400'); // SKR03 19%
    });
  });
});
