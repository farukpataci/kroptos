import { CatalogManifest } from '../core/catalog/CatalogManifest';

/**
 * docs/nebim.v3.agent.md §7.3 — Nebim V3 katalog SÖZLEŞMESİ.
 * SQL METNİ YOK: sorgular Agent'ın imzalı kurulum paketiyle gelir (`agent/catalog/nebim/*.sql`).
 * Kolon adları TAKMA ADDIR (`SELECT ... AS product_code`).
 * Gerçek kolon adları uydurulmaz (§11).
 */
export const NEBIM_V3_CATALOG: CatalogManifest = {
  provider: 'NEBIM-V3',
  version: '1',
  queries: [
    {
      queryId: 'nebim.invoice_by_ref',
      params: [{ name: 'ref', type: 'string', required: true, maxLength: 128, pattern: '^[A-Za-z0-9:_-]+$' }],
      expectedColumns: ['external_ref', 'document_id', 'document_no'],
      maxRows: 1,
      timeoutSec: 30,
    },
    {
      queryId: 'nebim.stock_by_warehouse',
      params: [
        { name: 'depoNo', type: 'string', required: false, maxLength: 32 },
        { name: 'limit', type: 'number', required: false, min: 1, max: 5000 },
        { name: 'offset', type: 'number', required: false, min: 0 },
      ],
      expectedColumns: ['product_code', 'warehouse_code', 'quantity'],
      maxRows: 5000,
      timeoutSec: 60,
    },
    {
      queryId: 'nebim.company_list',
      params: [],
      expectedColumns: ['company_no', 'title'],
      maxRows: 100,
      timeoutSec: 30,
    },
    {
      queryId: 'nebim.warehouse_list',
      params: [],
      expectedColumns: ['warehouse_code', 'warehouse_name'],
      maxRows: 500,
      timeoutSec: 30,
    },
  ],
};
