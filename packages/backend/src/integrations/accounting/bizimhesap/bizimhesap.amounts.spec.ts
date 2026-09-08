import { BadRequestException } from '@nestjs/common';
import { calculateAndVerifyBizimhesapAmounts } from './bizimhesap.amounts';
import { AccountingInvoiceRequest } from '../core/AccountingTypes';

describe('BizimHesap Amounts Calculations and Verifications', () => {
  const baseRequest: AccountingInvoiceRequest = {
    companyId: 'firm-123',
    referenceCode: 'ORD-100',
    issueDate: '2026-09-08',
    currency: 'TRY',
    contact: {
      name: 'Örnek Müşteri Ltd.',
      address: 'Maslak Mah. No:1 İstanbul',
    },
    items: [
      {
        sku: 'SKU-01',
        name: 'Ürün 1',
        quantity: 3,
        unitPrice: 33.33,
        vatRate: 20,
        discountAmount: 10,
        totalAmount: 107.99,
      },
    ],
    subtotal: 99.99,
    vatTotal: 18.0,
    grandTotal: 107.99,
  };

  it('1. should accurately compute single line item without mismatch', () => {
    const req: AccountingInvoiceRequest = {
      ...baseRequest,
      items: [
        {
          sku: 'SKU-01',
          name: 'Ürün A',
          quantity: 2,
          unitPrice: 100,
          vatRate: 20,
          discountAmount: 20,
          totalAmount: 216,
        },
      ],
      subtotal: 200,
      vatTotal: 36,
      grandTotal: 216,
    };

    const res = calculateAndVerifyBizimhesapAmounts(req, 'TL');
    expect(res.amounts.currency).toBe('TL');
    expect(res.amounts.gross).toBe(200);
    expect(res.amounts.discount).toBe(20);
    expect(res.amounts.net).toBe(180);
    expect(res.amounts.tax).toBe(36);
    expect(res.amounts.total).toBe(216);

    expect(res.details.length).toBe(1);
    expect(res.details[0].grossPrice).toBe(200);
    expect(res.details[0].net).toBe(180);
    expect(res.details[0].tax).toBe(36);
    expect(res.details[0].total).toBe(216);
  });

  it('2. should verify formula: grossPrice = quantity * unitPrice', () => {
    const req: AccountingInvoiceRequest = {
      ...baseRequest,
      items: [
        {
          sku: 'SKU-02',
          name: 'Ürün B',
          quantity: 5,
          unitPrice: 40.5,
          vatRate: 10,
          discountAmount: 0,
          totalAmount: 222.75,
        },
      ],
      subtotal: 202.5,
      vatTotal: 20.25,
      grandTotal: 222.75,
    };

    const res = calculateAndVerifyBizimhesapAmounts(req, 'TL');
    expect(res.details[0].grossPrice).toBe(202.5);
  });

  it('3. should verify formula: net = grossPrice - discount', () => {
    const req: AccountingInvoiceRequest = {
      ...baseRequest,
      items: [
        {
          sku: 'SKU-03',
          name: 'Ürün C',
          quantity: 2,
          unitPrice: 50,
          vatRate: 20,
          discountAmount: 15,
          totalAmount: 102,
        },
      ],
      subtotal: 100,
      vatTotal: 17,
      grandTotal: 102,
    };

    const res = calculateAndVerifyBizimhesapAmounts(req, 'TL');
    expect(res.details[0].grossPrice).toBe(100);
    expect(res.details[0].discount).toBe(15);
    expect(res.details[0].net).toBe(85);
  });

  it('4. should verify formula: tax = net * taxRate / 100 and total = net + tax', () => {
    const req: AccountingInvoiceRequest = {
      ...baseRequest,
      items: [
        {
          sku: 'SKU-04',
          name: 'Ürün D',
          quantity: 1,
          unitPrice: 100,
          vatRate: 20,
          discountAmount: 0,
          totalAmount: 120,
        },
      ],
      subtotal: 100,
      vatTotal: 20,
      grandTotal: 120,
    };

    const res = calculateAndVerifyBizimhesapAmounts(req, 'TL');
    expect(res.details[0].tax).toBe(20);
    expect(res.details[0].total).toBe(120);
  });

  it('5. should deterministically allocate residual kuruş artığı to the last item', () => {
    // 3 items with 33.33 each:
    // item 1: 33.33 * 1.20 = 39.996 -> 40.00 (tax: 6.67)
    // item 2: 33.33 * 1.20 = 39.996 -> 40.00 (tax: 6.67)
    // item 3: 33.33 * 1.20 = 39.996 -> 40.00 (tax: 6.67)
    // sum total = 120.00, but suppose grandTotal is 120.01 (1 cent rounding diff)
    const req: AccountingInvoiceRequest = {
      ...baseRequest,
      items: [
        {
          sku: 'SKU-01',
          name: 'Ürün 1',
          quantity: 1,
          unitPrice: 33.33,
          vatRate: 20,
          totalAmount: 40.0,
        },
        {
          sku: 'SKU-02',
          name: 'Ürün 2',
          quantity: 1,
          unitPrice: 33.33,
          vatRate: 20,
          totalAmount: 40.0,
        },
        {
          sku: 'SKU-03',
          name: 'Ürün 3',
          quantity: 1,
          unitPrice: 33.33,
          vatRate: 20,
          totalAmount: 40.0,
        },
      ],
      subtotal: 99.99,
      vatTotal: 20.02,
      grandTotal: 120.01,
    };

    const res = calculateAndVerifyBizimhesapAmounts(req, 'TL');
    expect(res.amounts.total).toBe(120.01);
    expect(res.details[0].total).toBe(40.0);
    expect(res.details[1].total).toBe(40.0);
    // Residual 0.01 cent was allocated to the last item:
    expect(res.details[2].total).toBe(40.01);
  });

  it('6. should throw BadRequestException if grandTotal difference exceeds tolerance', () => {
    const req: AccountingInvoiceRequest = {
      ...baseRequest,
      grandTotal: 500.0, // huge mismatch!
    };

    expect(() => calculateAndVerifyBizimhesapAmounts(req, 'TL')).toThrow(BadRequestException);
  });

  it('7. should throw BadRequestException if items array is empty', () => {
    const req: AccountingInvoiceRequest = {
      ...baseRequest,
      items: [],
    };

    expect(() => calculateAndVerifyBizimhesapAmounts(req, 'TL')).toThrow(BadRequestException);
  });
});
