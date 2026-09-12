/**
 * Fatture in Cloud (TeamSystem) Price & Amount Calculation Engine
 * Reference: FIC Developer Guide "Invoice totals calculation" & §5.4, §5.5
 *
 * CRITICAL RULE (§5.4):
 * Conversion between net and gross prices MUST happen ONLY in this file.
 * - If use_gross_prices is false (default): item requires net_price.
 * - If use_gross_prices is true: item requires gross_price.
 *
 * CRITICAL RULE (§5.5):
 * All amounts are strictly rounded to 2 decimal places.
 * Sum of payment schedule amounts must exactly match calculated gross total.
 */

export interface FicPriceConversionInput {
  unitPrice: number; // KroptOS stores net unit price
  vatRate: number; // e.g. 22 for 22%
  useGrossPrices: boolean;
}

export interface FicCalculatedItemPrice {
  net_price?: number;
  gross_price?: number;
  computedNetPrice: number;
  computedGrossPrice: number;
  vatRate: number;
}

export interface FicLineItemCalculationInput {
  qty: number;
  unitPrice: number;
  vatRate: number;
  discountPercentage?: number; // e.g. 10 for 10%
  useGrossPrices?: boolean;
}

export interface FicCalculatedLineItem {
  qty: number;
  net_price?: number;
  gross_price?: number;
  lineNetAmount: number;
  lineVatAmount: number;
  lineGrossAmount: number;
  vatRate: number;
}

export interface FicCalculatedDocumentTotals {
  amount_net: number;
  amount_vat: number;
  amount_gross: number;
  items: FicCalculatedLineItem[];
}

/**
 * Rounds a number to exactly two decimal places using standard financial round-half-up.
 */
export function roundToTwoDecimals(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Converts net unit price to the correct FIC price field based on use_gross_prices flag.
 */
export function computeItemPrice(input: FicPriceConversionInput): FicCalculatedItemPrice {
  const { unitPrice, vatRate, useGrossPrices } = input;
  const net = roundToTwoDecimals(unitPrice);
  const vatMultiplier = 1 + (vatRate || 0) / 100;
  const gross = roundToTwoDecimals(net * vatMultiplier);

  if (useGrossPrices) {
    return {
      gross_price: gross,
      net_price: undefined,
      computedNetPrice: net,
      computedGrossPrice: gross,
      vatRate,
    };
  }

  return {
    net_price: net,
    gross_price: undefined,
    computedNetPrice: net,
    computedGrossPrice: gross,
    vatRate,
  };
}

/**
 * Calculates line amounts (net, VAT, gross) for an item with quantity and optional discount.
 */
export function calculateLineItem(input: FicLineItemCalculationInput): FicCalculatedLineItem {
  const { qty, unitPrice, vatRate, discountPercentage = 0, useGrossPrices = false } = input;

  if (qty <= 0) {
    throw new Error(`Kalem miktarı sıfırdan büyük olmalıdır (verilen: ${qty})`);
  }

  const priceResult = computeItemPrice({ unitPrice, vatRate, useGrossPrices });

  // Base net amount for line
  let lineNetAmount = priceResult.computedNetPrice * qty;
  if (discountPercentage > 0) {
    const discountFactor = Math.max(0, 1 - discountPercentage / 100);
    lineNetAmount = lineNetAmount * discountFactor;
  }
  lineNetAmount = roundToTwoDecimals(lineNetAmount);

  // VAT and Gross
  const lineVatAmount = roundToTwoDecimals(lineNetAmount * ((vatRate || 0) / 100));
  const lineGrossAmount = roundToTwoDecimals(lineNetAmount + lineVatAmount);

  return {
    qty,
    net_price: priceResult.net_price,
    gross_price: priceResult.gross_price,
    lineNetAmount,
    lineVatAmount,
    lineGrossAmount,
    vatRate,
  };
}

/**
 * Calculates complete document totals from item lines.
 */
export function calculateDocumentTotals(
  items: FicLineItemCalculationInput[],
  useGrossPrices: boolean = false,
): FicCalculatedDocumentTotals {
  if (!items || items.length === 0) {
    throw new Error('Fatura toplamı hesaplamak için en az bir kalem gereklidir.');
  }

  let totalNet = 0;
  let totalVat = 0;
  const calculatedItems: FicCalculatedLineItem[] = [];

  for (const item of items) {
    const calculated = calculateLineItem({ ...item, useGrossPrices });
    calculatedItems.push(calculated);
    totalNet += calculated.lineNetAmount;
    totalVat += calculated.lineVatAmount;
  }

  const roundedNet = roundToTwoDecimals(totalNet);
  const roundedVat = roundToTwoDecimals(totalVat);
  const roundedGross = roundToTwoDecimals(roundedNet + roundedVat);

  return {
    amount_net: roundedNet,
    amount_vat: roundedVat,
    amount_gross: roundedGross,
    items: calculatedItems,
  };
}
