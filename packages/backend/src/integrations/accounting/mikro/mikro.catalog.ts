import { CatalogManifest } from '../core/catalog/CatalogManifest';

/**
 * docs/mikro.agent.md §7.3 — katalog SÖZLEŞMESİ. SQL METNİ YOK: sorgular Agent'ın imzalı
 * kurulum paketiyle gelir (`agent/catalog/mikro/*.sql`). Kolon adları TAKMA ADDIR
 * (`SELECT ... AS product_code`); gerçek Mikro kolon adları Faz D'de doğrulanır.
 */
export const MIKRO_CATALOG: CatalogManifest = {
  provider: 'MIKRO',
  version: '1',
  queries: [
    {
      queryId: 'mikro.invoice_by_ref',
      params: [{ name: 'ref', type: 'string', required: true, maxLength: 64, pattern: '^[A-Za-z0-9:_-]+$' }],
      expectedColumns: ['external_ref', 'document_id', 'document_no'],
      maxRows: 1,
      timeoutSec: 15,
    },
    {
      queryId: 'mikro.stock_by_warehouse',
      params: [
        { name: 'depoNo', type: 'number', required: false, min: 0, max: 9999 },
        { name: 'limit', type: 'number', required: false, min: 1, max: 5000 },
        { name: 'offset', type: 'number', required: false, min: 0 },
      ],
      expectedColumns: ['product_code', 'warehouse_code', 'quantity'],
      maxRows: 5000,
      timeoutSec: 60,
    },
    {
      queryId: 'mikro.company_list',
      params: [],
      expectedColumns: ['company_no', 'title'],
      maxRows: 100,
      timeoutSec: 15,
    },
    {
      queryId: 'mikro.warehouse_list',
      params: [],
      expectedColumns: ['warehouse_code', 'warehouse_name'],
      maxRows: 500,
      timeoutSec: 15,
    },
  ],
};
