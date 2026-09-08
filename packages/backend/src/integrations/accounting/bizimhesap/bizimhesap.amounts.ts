import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AccountingInvoiceItem, AccountingInvoiceRequest } from '../core/AccountingTypes';
import { BizimhesapAmounts, BizimhesapInvoiceDetailItem } from './bizimhesap.types';

const Decimal = Prisma.Decimal;

export interface BizimhesapCalculatedAmounts {
  amounts: BizimhesapAmounts;
  details: BizimhesapInvoiceDetailItem[];
}

/**
 * Calculates and strictly verifies BizimHesap line-item and header amounts.
 * Uses Prisma.Decimal for arbitrary precision arithmetic.
 * Any residual kuruş difference is allocated deterministically to the last line item.
 */
export function calculateAndVerifyBizimhesapAmounts(
  request: AccountingInvoiceRequest,
  currencyCode: 'TL' | 'USD' | 'EUR' | 'CHF' | 'GBP',
): BizimhesapCalculatedAmounts {
  if (!request.items || request.items.length === 0) {
    throw new BadRequestException('Faturada en az bir kalem bulunmalıdır.');
  }

  const items = request.items;
  const lastIndex = items.length - 1;

  let computedSumGross = new Decimal(0);
  let computedSumDiscount = new Decimal(0);
  let computedSumNet = new Decimal(0);
  let computedSumTax = new Decimal(0);
  let computedSumTotal = new Decimal(0);

  const rawDetails: Array<{
    item: AccountingInvoiceItem;
    quantity: Prisma.Decimal;
    unitPrice: Prisma.Decimal;
    grossPrice: Prisma.Decimal;
    discount: Prisma.Decimal;
    net: Prisma.Decimal;
    taxRate: Prisma.Decimal;
    tax: Prisma.Decimal;
    total: Prisma.Decimal;
  }> = [];

  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    const qty = new Decimal(it.quantity);
    const unitPrice = new Decimal(it.unitPrice).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const grossPrice = qty.mul(unitPrice).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const discount = new Decimal(it.discountAmount || 0).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const net = grossPrice.minus(discount).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const taxRate = new Decimal(it.vatRate);
    const tax = net.mul(taxRate).div(100).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    const total = net.plus(tax).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

    computedSumGross = computedSumGross.plus(grossPrice);
    computedSumDiscount = computedSumDiscount.plus(discount);
    computedSumNet = computedSumNet.plus(net);
    computedSumTax = computedSumTax.plus(tax);
    computedSumTotal = computedSumTotal.plus(total);

    rawDetails.push({
      item: it,
      quantity: qty,
      unitPrice,
      grossPrice,
      discount,
      net,
      taxRate,
      tax,
      total,
    });
  }

  const targetGrandTotal = new Decimal(request.grandTotal).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  // Kuruş artığı kontrolü (Residual cent adjustment allocated deterministically to the last line)
  const totalDiff = targetGrandTotal.minus(computedSumTotal);
  if (!totalDiff.isZero()) {
    if (totalDiff.abs().greaterThan(0.05)) {
      throw new BadRequestException(
        `Fatura tutar uyumsuzluğu: Kalemler toplamı (${computedSumTotal.toFixed(2)}) ile sipariş genel toplamı (${targetGrandTotal.toFixed(2)}) arasındaki fark (${totalDiff.toFixed(2)}) kabul edilebilir toleransı aşıyor.`,
      );
    }
    // Adjust last item's tax and total
    const last = rawDetails[lastIndex];
    last.tax = last.tax.plus(totalDiff).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    last.total = last.net.plus(last.tax).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    computedSumTax = computedSumTax.plus(totalDiff);
    computedSumTotal = computedSumTotal.plus(totalDiff);
  }

  // Build BizimHesap Detail Items
  const details: BizimhesapInvoiceDetailItem[] = rawDetails.map((d) => ({
    productId: d.item.sku,
    productName: d.item.name,
    taxRate: d.taxRate.toNumber(),
    quantity: d.quantity.toNumber(),
    unitPrice: d.unitPrice.toNumber(),
    grossPrice: d.grossPrice.toNumber(),
    discount: d.discount.toNumber(),
    net: d.net.toNumber(),
    tax: d.tax.toNumber(),
    total: d.total.toNumber(),
  }));

  // Build BizimHesap Header Amounts
  const amounts: BizimhesapAmounts = {
    currency: currencyCode,
    gross: computedSumGross.toNumber(),
    discount: computedSumDiscount.toNumber(),
    net: computedSumNet.toNumber(),
    tax: computedSumTax.toNumber(),
    total: computedSumTotal.toNumber(),
  };

  // Strict Verifications (§4.4)
  // 1. Line item formulas
  for (let idx = 0; idx < details.length; idx++) {
    const d = details[idx];
    const computedGross = new Decimal(d.quantity).mul(new Decimal(d.unitPrice)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    if (!computedGross.equals(new Decimal(d.grossPrice))) {
      throw new BadRequestException(
        `Kalem #${idx + 1} grossPrice formül hatası: Beklenen ${computedGross.toFixed(2)}, Mevcut: ${d.grossPrice}`,
      );
    }
    const computedNet = new Decimal(d.grossPrice).minus(new Decimal(d.discount)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    if (!computedNet.equals(new Decimal(d.net))) {
      throw new BadRequestException(
        `Kalem #${idx + 1} net formül hatası: Beklenen ${computedNet.toFixed(2)}, Mevcut: ${d.net}`,
      );
    }
    const computedTotal = new Decimal(d.net).plus(new Decimal(d.tax)).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    if (!computedTotal.equals(new Decimal(d.total))) {
      throw new BadRequestException(
        `Kalem #${idx + 1} total formül hatası: Beklenen ${computedTotal.toFixed(2)}, Mevcut: ${d.total}`,
      );
    }
  }

  // 2. Line totals sum must equal header amounts
  const sumDetailNet = details.reduce((acc, d) => acc.plus(new Decimal(d.net)), new Decimal(0));
  const sumDetailTax = details.reduce((acc, d) => acc.plus(new Decimal(d.tax)), new Decimal(0));
  const sumDetailTotal = details.reduce((acc, d) => acc.plus(new Decimal(d.total)), new Decimal(0));

  if (!sumDetailNet.equals(new Decimal(amounts.net))) {
    throw new BadRequestException(
      `Kalem net toplamı (${sumDetailNet.toFixed(2)}) başlık net (${amounts.net}) ile uyuşmuyor.`,
    );
  }
  if (!sumDetailTax.equals(new Decimal(amounts.tax))) {
    throw new BadRequestException(
      `Kalem KDV toplamı (${sumDetailTax.toFixed(2)}) başlık KDV (${amounts.tax}) ile uyuşmuyor.`,
    );
  }
  if (!sumDetailTotal.equals(new Decimal(amounts.total))) {
    throw new BadRequestException(
      `Kalem genel toplamı (${sumDetailTotal.toFixed(2)}) başlık toplamı (${amounts.total}) ile uyuşmuyor.`,
    );
  }

  // 3. Header total must equal KroptOS order grandTotal
  if (!new Decimal(amounts.total).equals(targetGrandTotal)) {
    throw new BadRequestException(
      `Başlık toplamı (${amounts.total}) sipariş genel toplamı (${targetGrandTotal.toFixed(2)}) ile uyuşmuyor.`,
    );
  }

  return { amounts, details };
}
