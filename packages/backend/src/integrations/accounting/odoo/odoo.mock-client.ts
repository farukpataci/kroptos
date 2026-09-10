import { IOdooTransport } from './odoo.transport';
import {
  OdooCallParams,
  OdooMove,
  OdooPartner,
  OdooPayment,
  OdooProduct,
  OdooSchemaField,
  OdooTransportKind,
  OdooVersionInfo,
} from './odoo.types';
import { OdooAllowlistValidator } from './odoo.allowlist';

/**
 * In-Memory Mock Transport for Odoo (§7)
 */
export class OdooMockTransport implements IOdooTransport {
  public kind: OdooTransportKind = 'json2';

  public version: OdooVersionInfo = {
    server_version: '19.0+e',
    server_version_info: [19, 0, 0, 'final', 0],
    server_serie: '19.0',
    protocol_version: 1,
    majorVersion: 19,
  };

  public moves: Map<number, OdooMove> = new Map();
  public partners: Map<number, OdooPartner> = new Map();
  public products: Map<number, OdooProduct> = new Map();
  public payments: Map<number, OdooPayment> = new Map();

  public calls: Array<{
    model: string;
    method: string;
    args?: any[];
    kwargs?: Record<string, any>;
    companyId?: number | string;
  }> = [];

  public simulateMissingField?: string;
  public simulateAmountMismatch?: boolean;

  constructor(majorVersion: number = 19) {
    this.setVersion(majorVersion);
    this.seedDefaultData();
  }

  setVersion(major: number): void {
    this.version = {
      server_version: `${major}.0`,
      server_version_info: [major, 0, 0],
      server_serie: `${major}.0`,
      protocol_version: 1,
      majorVersion: major,
    };
    this.kind = major >= 19 ? 'json2' : 'rpc';
  }

  private seedDefaultData(): void {
    // Seed default partner
    this.partners.set(1, {
      id: 1,
      name: 'Default Test Customer',
      email: 'customer@example.com',
      vat: 'BE0123456789',
    });
  }

  async execute<T>(params: OdooCallParams): Promise<T> {
    const { model, method, args = [], kwargs = {}, companyId } = params;

    // §5.1: Verify allowlist even in mock mode
    OdooAllowlistValidator.assertAllowed(model, method);

    this.calls.push({ model, method, args, kwargs, companyId });

    // Handle fields_get introspection (§5.2)
    if (method === 'fields_get') {
      return this.handleFieldsGet(model) as T;
    }

    // Model: res.company
    if (model === 'res.company') {
      if (method === 'search_read' || method === 'read') {
        return [
          {
            id: 1,
            name: 'KroptOS Global Belux BV',
            vat: 'BE0987654321',
            country_id: [1, 'Belgium'],
          },
        ] as T;
      }
    }

    // Model: res.partner
    if (model === 'res.partner') {
      if (method === 'search_read') {
        const domain = (kwargs.domain || args[0]) as any[][];
        if (domain && Array.isArray(domain)) {
          for (const partner of this.partners.values()) {
            for (const cond of domain) {
              const [field, op, val] = cond;
              if (op === '=' && partner[field as keyof OdooPartner] === val) {
                return [partner] as T;
              }
            }
          }
        }
        return Array.from(this.partners.values()) as T;
      }
      if (method === 'create') {
        const payload = (kwargs.values || args[0]) as Partial<OdooPartner>;
        const id = this.partners.size + 1;
        const newPartner: OdooPartner = {
          id,
          name: payload.name || `Partner ${id}`,
          email: payload.email,
          phone: payload.phone,
          vat: payload.vat,
          street: payload.street,
          city: payload.city,
        };
        this.partners.set(id, newPartner);
        return (this.kind === 'json2' ? id : [id]) as T;
      }
      if (method === 'read') {
        const ids = (kwargs.ids || args[0] || []) as number[];
        return ids.map((id) => this.partners.get(id)).filter(Boolean) as T;
      }
    }

    // Model: product.product
    if (model === 'product.product') {
      if (method === 'search_read') {
        return Array.from(this.products.values()) as T;
      }
      if (method === 'create') {
        const payload = (kwargs.values || args[0]) as Partial<OdooProduct>;
        const id = this.products.size + 1;
        const newProduct: OdooProduct = {
          id,
          name: payload.name || `Product ${id}`,
          default_code: payload.default_code,
          list_price: payload.list_price || 0,
        };
        this.products.set(id, newProduct);
        return (this.kind === 'json2' ? id : [id]) as T;
      }
    }

    // Model: account.move
    if (model === 'account.move') {
      if (method === 'create') {
        const payload = (kwargs.values || args[0]) as any;
        const id = this.moves.size + 1;

        // Calculate amount from lines
        let amountTotal = 0;
        const lineCommands = payload.invoice_line_ids || [];
        for (const cmd of lineCommands) {
          if (Array.isArray(cmd) && cmd.length >= 3 && cmd[0] === 0) {
            const vals = cmd[2];
            amountTotal += Number(vals.quantity || 1) * Number(vals.price_unit || 0);
          }
        }

        // Simulate amount mismatch scenario (§7)
        if (this.simulateAmountMismatch) {
          amountTotal += 50.0;
        }

        const newMove: OdooMove = {
          id,
          name: '/', // In draft, document name is "/"
          ref: payload.ref,
          state: 'draft',
          move_type: payload.move_type || 'out_invoice',
          partner_id: payload.partner_id,
          invoice_date: payload.invoice_date,
          amount_untaxed: amountTotal,
          amount_tax: 0,
          amount_total: amountTotal,
          invoice_line_ids: lineCommands,
        };

        this.moves.set(id, newMove);
        return (this.kind === 'json2' ? id : [id]) as T;
      }

      if (method === 'read') {
        const ids = (kwargs.ids || args[0] || []) as number[];
        return ids.map((id) => this.moves.get(id)).filter(Boolean) as T;
      }

      if (method === 'search_read') {
        const domain = (kwargs.domain || args[0]) as any[][];
        if (domain && Array.isArray(domain)) {
          const matched: OdooMove[] = [];
          for (const move of this.moves.values()) {
            let match = true;
            for (const cond of domain) {
              const [field, op, val] = cond;
              if (op === '=' && (move as any)[field] !== val) {
                match = false;
                break;
              }
            }
            if (match) matched.push(move);
          }
          return matched as T;
        }
        return Array.from(this.moves.values()) as T;
      }

      if (method === 'action_post') {
        const ids = (kwargs.ids || args[0] || []) as number[];
        for (const id of ids) {
          const move = this.moves.get(id);
          if (move) {
            move.state = 'posted';
            move.name = `INV/2026/${String(id).padStart(5, '0')}`;
          }
        }
        return true as T;
      }

      if (method === 'button_cancel') {
        const ids = (kwargs.ids || args[0] || []) as number[];
        for (const id of ids) {
          const move = this.moves.get(id);
          if (move) {
            move.state = 'cancel';
          }
        }
        return true as T;
      }
    }

    // Model: account.payment
    if (model === 'account.payment') {
      if (method === 'create') {
        const payload = (kwargs.values || args[0]) as any;
        const id = this.payments.size + 1;
        const newPayment: OdooPayment = {
          id,
          payment_type: payload.payment_type || 'inbound',
          partner_type: payload.partner_type || 'customer',
          partner_id: payload.partner_id,
          amount: payload.amount,
          ref: payload.ref,
          date: payload.date,
          state: 'draft',
        };
        this.payments.set(id, newPayment);
        return (this.kind === 'json2' ? id : [id]) as T;
      }

      if (method === 'action_post') {
        const ids = (kwargs.ids || args[0] || []) as number[];
        for (const id of ids) {
          const pay = this.payments.get(id);
          if (pay) pay.state = 'posted';
        }
        return true as T;
      }
    }

    return [] as T;
  }

  private handleFieldsGet(model: string): Record<string, OdooSchemaField> {
    const defaultFields: Record<string, OdooSchemaField> = {
      name: { type: 'char', string: 'Name', required: true },
      ref: { type: 'char', string: 'Reference' },
      state: { type: 'selection', string: 'Status' },
      move_type: { type: 'selection', string: 'Type' },
      partner_id: { type: 'many2one', string: 'Partner', relation: 'res.partner' },
      invoice_line_ids: { type: 'one2many', string: 'Lines', relation: 'account.move.line' },
      amount_total: { type: 'monetary', string: 'Total' },
      quantity: { type: 'float', string: 'Quantity' },
      price_unit: { type: 'monetary', string: 'Unit Price' },
    };

    if (this.simulateMissingField && this.simulateMissingField.startsWith(`${model}.`)) {
      const fieldToDelete = this.simulateMissingField.substring(model.length + 1);
      delete defaultFields[fieldToDelete];
    }

    return defaultFields;
  }
}
