import { PostingFieldSpec } from '../core/AccountingTypes';

/**
 * docs/nebim.v3.agent.md §3.4, §7.4 — Nebim V3 kayıt parametreleri şeması (D6).
 * Mağaza ve depo kodları firma ekseni (CompanyKey) DEĞİLDİR; kayıt hedefidir.
 * `required: true` olanlar eksikken yazma işi kuyruğa girmez (K17).
 */
export const NEBIM_POSTING_DEFAULTS: PostingFieldSpec[] = [
  {
    key: 'storeCode',
    label: 'Mağaza Kodu',
    required: true,
    appliesTo: ['INVOICE', 'ORDER', 'RECEIPT'],
  },
  {
    key: 'orderWarehouseCode',
    label: 'Sipariş Aktarımı Depo Kodu',
    required: true,
    appliesTo: ['ORDER', 'INVOICE'],
  },
  {
    key: 'deliveryCode',
    label: 'Teslimat Yönetim Kodu',
    required: false,
    appliesTo: ['ORDER', 'INVOICE'],
  },
  {
    key: 'creditCardTypeCode',
    label: 'Kredi Kartı Tip Kodu',
    required: false,
    appliesTo: ['RECEIPT'],
  },
  {
    key: 'bankAccountCode',
    label: 'Banka Hesabı Kodu',
    required: false,
    appliesTo: ['RECEIPT'],
  },
];
