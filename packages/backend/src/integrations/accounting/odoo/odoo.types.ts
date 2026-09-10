/**
 * Odoo ERP & Accounting Type Definitions (§3, §4, §5)
 */

export interface OdooVersionInfo {
  server_version: string;
  server_version_info: (number | string)[];
  server_serie: string;
  protocol_version: number;
  majorVersion: number;
}

export type OdooTransportKind = 'json2' | 'rpc';

export interface OdooCallParams {
  model: string;
  method: string;
  args?: any[];
  kwargs?: Record<string, any>;
  companyId?: number | string;
}

export interface OdooSchemaField {
  type: string;
  string: string;
  required?: boolean;
  readonly?: boolean;
  relation?: string;
  selection?: [string, string][];
}

export interface OdooSchemaDiscovery {
  version: OdooVersionInfo;
  transport: OdooTransportKind;
  discoveredAt: string;
  models: {
    'account.move'?: Record<string, OdooSchemaField>;
    'account.move.line'?: Record<string, OdooSchemaField>;
    'res.partner'?: Record<string, OdooSchemaField>;
    'product.product'?: Record<string, OdooSchemaField>;
    'account.payment'?: Record<string, OdooSchemaField>;
  };
  missingRequiredFields?: string[];
  isValid: boolean;
}

export interface OdooPartner {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  vat?: string;
  street?: string;
  city?: string;
  country_id?: [number, string] | number;
  company_id?: [number, string] | number;
}

export interface OdooProduct {
  id: number;
  name: string;
  default_code?: string; // SKU
  barcode?: string;
  list_price?: number;
  standard_price?: number;
  type?: string;
}

export type OdooMoveType = 'out_invoice' | 'out_refund' | 'in_invoice' | 'in_refund' | 'entry';
export type OdooMoveState = 'draft' | 'posted' | 'cancel';

export interface OdooMoveLine {
  id?: number;
  name: string;
  product_id?: number;
  quantity: number;
  price_unit: number;
  tax_ids?: number[];
  price_subtotal?: number;
  price_total?: number;
  account_id?: number;
}

export interface OdooMove {
  id: number;
  name: string; // Document number, e.g. "INV/2026/00001" or "/"
  ref?: string; // KroptOS referenceCode
  state: OdooMoveState;
  move_type: OdooMoveType;
  partner_id: [number, string] | number;
  invoice_date?: string;
  invoice_date_due?: string;
  currency_id?: [number, string] | number;
  company_id?: [number, string] | number;
  amount_untaxed?: number;
  amount_tax?: number;
  amount_total?: number;
  amount_residual?: number;
  invoice_line_ids?: (number | OdooMoveLine)[];
}

export interface OdooPayment {
  id: number;
  name?: string;
  payment_type: 'inbound' | 'outbound';
  partner_type: 'customer' | 'supplier';
  partner_id: number;
  amount: number;
  currency_id?: number;
  date?: string;
  journal_id?: number;
  state?: 'draft' | 'posted' | 'cancel';
  ref?: string;
}

export interface OdooErrorPayload {
  name?: string;
  code?: number | string;
  message?: string;
  data?: {
    name?: string;
    debug?: string;
    message?: string;
    arguments?: any[];
    context?: Record<string, any>;
  };
}
