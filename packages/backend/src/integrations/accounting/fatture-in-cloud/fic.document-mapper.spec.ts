import { BadRequestException } from '@nestjs/common';
import { FicDocumentMapper } from './fic.document-mapper';
import { AccountingInvoiceRequest } from '../core/AccountingTypes';

describe('Fatture in Cloud Document Mapper & Validator (fic.document-mapper.ts)', () => {
  const baseRequest: AccountingInvoiceRequest = {
    companyId: '12345',
    referenceCode: 'ORD-999',
    issueDate: '2026-09-11',
    dueDate: '2026-10-11',
    currency: 'EUR',
    contact: {
      name: 'Mario Rossi S.r.l.',
      taxNumber: 'IT12345678901',
      address: 'Via Roma, 10',
      district: '20100', // CAP
      city: 'Milano',
      email: 'mario@rossi.it',
    },
    items: [
      {
        sku: 'SKU-001',
        name: 'Servizio Consulenza',
        quantity: 2,
        unitPrice: 100,
        vatRate: 22,
        totalAmount: 244,
      },
    ],
    subtotal: 200,
    vatTotal: 44,
    grandTotal: 244,
  };

  it('should successfully map a valid request with net prices (use_gross_prices: false)', () => {
    const payload = FicDocumentMapper.toIssuedDocumentPayload(baseRequest, {
      companyId: '12345',
      useGrossPrices: false,
      defaultVatId: 0,
      paymentAccountId: 10,
      isPaid: false,
    });

    expect(payload.type).toBe('invoice');
    expect(payload.entity.name).toBe('Mario Rossi S.r.l.');
    expect(payload.entity.vat_number).toBe('IT12345678901');
    expect(payload.entity.address_street).toBe('Via Roma, 10');
    expect(payload.entity.address_postal_code).toBe('20100');
    expect(payload.entity.address_city).toBe('Milano');
    expect(payload.entity.country).toBe('Italia');

    expect(payload.items_list.length).toBe(1);
    expect(payload.items_list[0].name).toBe('Servizio Consulenza');
    expect(payload.items_list[0].qty).toBe(2);
    expect(payload.items_list[0].net_price).toBe(100);
    expect(payload.items_list[0].gross_price).toBeUndefined();
    expect(payload.items_list[0].vat.id).toBe(0);

    expect(payload.payments_list?.length).toBe(1);
    expect(payload.payments_list?.[0].amount).toBe(244);
    expect(payload.payments_list?.[0].status).toBe('not_paid');

    expect(payload.e_invoice).toBe(true);
    expect(payload.ei_data?.payment_method).toBe('MP05');
  });

  it('should map items with gross_price when use_gross_prices is true (§5.4)', () => {
    const payload = FicDocumentMapper.toIssuedDocumentPayload(baseRequest, {
      companyId: '12345',
      useGrossPrices: true,
      defaultVatId: 0,
    });

    expect(payload.use_gross_prices).toBe(true);
    expect(payload.items_list[0].gross_price).toBe(122);
    expect(payload.items_list[0].net_price).toBeUndefined();
  });

  it('should throw BadRequestException if contact name is missing (§5.3)', () => {
    const invalidRequest = {
      ...baseRequest,
      contact: { ...baseRequest.contact, name: '   ' },
    };

    expect(() =>
      FicDocumentMapper.toIssuedDocumentPayload(invalidRequest, { companyId: '12345' }),
    ).toThrow(BadRequestException);
    expect(() =>
      FicDocumentMapper.toIssuedDocumentPayload(invalidRequest, { companyId: '12345' }),
    ).toThrow(/müşteri adı\/unvanı \(name\) zorunludur/);
  });

  it('should throw BadRequestException if taxNumber/vat_number is missing (§5.3)', () => {
    const invalidRequest = {
      ...baseRequest,
      contact: { ...baseRequest.contact, taxNumber: '' },
    };

    expect(() =>
      FicDocumentMapper.toIssuedDocumentPayload(invalidRequest, { companyId: '12345' }),
    ).toThrow(BadRequestException);
    expect(() =>
      FicDocumentMapper.toIssuedDocumentPayload(invalidRequest, { companyId: '12345' }),
    ).toThrow(/vergi numarası \/ Codice Fiscale \/ Partita IVA zorunludur/);
  });

  it('should throw BadRequestException if street address is missing (§5.3)', () => {
    const noAddress = {
      ...baseRequest,
      contact: { ...baseRequest.contact, address: '' },
    };
    expect(() =>
      FicDocumentMapper.toIssuedDocumentPayload(noAddress, { companyId: '12345' }),
    ).toThrow(/açık adres bilgisi \(address_street\) zorunludur/);
  });

  it('should throw BadRequestException if items array is empty (§5.3)', () => {
    const noItems = {
      ...baseRequest,
      items: [],
    };
    expect(() =>
      FicDocumentMapper.toIssuedDocumentPayload(noItems, { companyId: '12345' }),
    ).toThrow(BadRequestException);
  });

  it('should throw BadRequestException if isPaid is true but paymentAccountId is missing (§5.6)', () => {
    expect(() =>
      FicDocumentMapper.toIssuedDocumentPayload(baseRequest, {
        companyId: '12345',
        isPaid: true,
        paymentAccountId: undefined,
      }),
    ).toThrow(BadRequestException);
    expect(() =>
      FicDocumentMapper.toIssuedDocumentPayload(baseRequest, {
        companyId: '12345',
        isPaid: true,
        paymentAccountId: undefined,
      }),
    ).toThrow(/payment_account\.id \(kasa\/banka hesabı\) zorunludur/);
  });

  it('should attach product_id when SKU is mapped and still fully populate item fields (§5.3)', () => {
    const payload = FicDocumentMapper.toIssuedDocumentPayload(baseRequest, {
      companyId: '12345',
      useGrossPrices: false,
      productMappings: {
        'SKU-001': '8842',
      },
    });

    expect(payload.items_list[0].product_id).toBe(8842);
    // Explicitly populated:
    expect(payload.items_list[0].name).toBe('Servizio Consulenza');
    expect(payload.items_list[0].qty).toBe(2);
    expect(payload.items_list[0].net_price).toBe(100);
    expect(payload.items_list[0].vat.id).toBe(0);
  });
});
