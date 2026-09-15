/**
 * İzin kataloğu — TEK KAYNAK. Backend seed'i ve frontend buradan okur;
 * izin string'i literal olarak başka yerde geçmez (controller'lardaki
 * @RequirePermission hariç, onlar da bu anahtarlardan biri olmak zorunda).
 *
 * Ad biçimi `kaynak.aksiyon` (CLAUDE.md Kural 5). Mevcut adlar yeniden
 * adlandırılMAZ; read→view gibi kozmetik değişiklik yok.
 *
 * Kaynak birleşimi (2026-09-15): canlı DB 54 izin + seed'in DB'ye henüz
 * inmemiş 4 izni (agent.read, agent.manage, accounting.credential.manage,
 * accounting.invoice.push) + P4'ün eklediği 8 izin = 66.
 */
export const PERMISSION_CATEGORIES = [
  'Katalog',
  'Envanter & Depo',
  'Sipariş & Sevkiyat',
  'Entegrasyon',
  'Muhasebe',
  'Analitik',
  'Kiracı Yönetimi',
  'Sistem',
] as const;
export type PermissionCategory = (typeof PERMISSION_CATEGORIES)[number];

export interface PermissionDef {
  key: string;
  name: string;
  description: string;
  category: PermissionCategory;
  /** Katalogda tanımlı ama henüz hiçbir uç istemiyor; kaldırma, bağlanacak. */
  unusedYet?: true;
}

const P = <K extends string>(key: K, name: string, description: string, category: PermissionCategory, unusedYet?: true) =>
  ({ key, name, description, category, ...(unusedYet ? { unusedYet } : {}) }) as PermissionDef & { key: K };

export const PERMISSIONS = [
  // ---- Sistem ----
  P('*:*', 'Tam yetki', 'Wildcard full access', 'Sistem'),
  P('system.settings.read', 'Sistem ayarlarını gör', 'View system, tenant, security and notification settings', 'Sistem'),
  P('system.settings.manage', 'Sistem ayarlarını yönet', 'Change system, tenant, security and notification settings', 'Sistem'),
  P('system.settings.write', 'Mağaza ataması', 'Assign stores to users', 'Sistem'),
  P('audit.read', 'Denetim kaydı', 'View audit log records', 'Sistem'),

  // ---- Kiracı Yönetimi ----
  P('agencies.read', 'Ajansları gör', 'View agencies list and details', 'Kiracı Yönetimi'),
  P('agencies.create', 'Ajans oluştur', 'Create new agencies', 'Kiracı Yönetimi'),
  P('agencies.write', 'Ajans düzenle/sil', 'Update or delete agencies', 'Kiracı Yönetimi'),
  P('clients.read', "Client'ları gör", 'View client accounts', 'Kiracı Yönetimi'),
  P('clients.create', 'Client oluştur', 'Create new clients', 'Kiracı Yönetimi'),
  P('clients.write', 'Client düzenle/sil', 'Update or delete clients', 'Kiracı Yönetimi'),
  P('stores.read', 'Mağazaları gör', 'View store channels', 'Kiracı Yönetimi'),
  P('stores.create', 'Mağaza oluştur', 'Create new stores', 'Kiracı Yönetimi'),
  P('stores.write', 'Mağaza düzenle/sil', 'Update or delete stores', 'Kiracı Yönetimi'),
  P('users.view', 'Kullanıcıları gör', 'View users and their access scopes in the active tenant', 'Kiracı Yönetimi'),
  P('users.manage', 'Kullanıcıları yönet', 'Invite, edit, assign roles to and remove users in the active tenant', 'Kiracı Yönetimi'),
  P('roles.view', 'Rolleri gör', 'View roles and the permission matrix', 'Kiracı Yönetimi'),
  P('roles.manage', 'Rolleri yönet', 'Create, edit and delete tenant roles', 'Kiracı Yönetimi'),

  // ---- Katalog ----
  P('products.read', 'Ürünleri gör', 'View products', 'Katalog'),
  P('products.create', 'Ürün ekle', 'Add new products', 'Katalog'),
  P('products.update', 'Ürün düzenle', 'Update products and their marketplace mappings', 'Katalog'),
  P('products.delete', 'Ürün sil', 'Delete products', 'Katalog'),

  // ---- Envanter & Depo ----
  P('warehouse.manage', 'Depo yönetimi', 'Manage inventories and warehouse popups', 'Envanter & Depo'),
  P('wms.view', 'WMS erişimi', 'Access WMS interface', 'Envanter & Depo'),
  P('wms.manage', 'WMS yönetimi', 'Full WMS administration', 'Envanter & Depo', true),
  P('wms.print', 'WMS yazdırma', 'Trigger print jobs in WMS', 'Envanter & Depo'),
  P('wms.settings.update', 'WMS ayarları', 'Update WMS printer/label settings', 'Envanter & Depo'),
  P('wms.labels.view', 'Etiketleri gör', 'View WMS shipping labels', 'Envanter & Depo'),
  P('wms.labels.create', 'Etiket oluştur', 'Create shipping labels in WMS', 'Envanter & Depo'),
  P('wms.stock.view', 'Stok hareketlerini gör', 'View WMS stock movements', 'Envanter & Depo'),
  P('wms.stock.update', 'Stok düzelt', 'Modify WMS stock levels', 'Envanter & Depo'),
  P('warehouse.settings.read', 'Depo ayarlarını gör', 'View warehouses, zones, locations and stock sources', 'Envanter & Depo'),
  P('warehouse.settings.manage', 'Depo ayarlarını yönet', 'Manage warehouses, zones, locations and stock sources', 'Envanter & Depo'),
  P('stock.allocation.read', 'Stok dağıtımını gör', 'View and calculate stock allocation rules', 'Envanter & Depo'),
  P('stock.allocation.manage', 'Stok dağıtımını yönet', 'Create and change stock allocation rules', 'Envanter & Depo'),

  // ---- Sipariş & Sevkiyat ----
  P('orders.read', 'Siparişleri gör', 'View client orders', 'Sipariş & Sevkiyat'),
  P('orders.update', 'Sipariş düzenle', 'Modify orders', 'Sipariş & Sevkiyat'),
  P('orders.cancel', 'Sipariş iptal/iade', 'Cancel or refund orders', 'Sipariş & Sevkiyat'),
  P('carriers.read', 'Kargo bağlantılarını gör', 'View carrier connections', 'Sipariş & Sevkiyat'),
  P('carriers.create', 'Kargo bağlantısı ekle', 'Add carrier connections', 'Sipariş & Sevkiyat'),
  P('carriers.update', 'Kargo bağlantısı düzenle', 'Change or test carrier connections', 'Sipariş & Sevkiyat'),
  P('carriers.delete', 'Kargo bağlantısı sil', 'Remove carrier connections', 'Sipariş & Sevkiyat'),
  P('shipments.read', 'Gönderileri gör', 'View shipments and tracking events', 'Sipariş & Sevkiyat'),
  P('shipments.create', 'Gönderi oluştur', 'Create shipments and obtain barcodes', 'Sipariş & Sevkiyat'),
  P('shipments.cancel', 'Gönderi iptal', 'Cancel shipments at the carrier', 'Sipariş & Sevkiyat'),
  P('shipments.label.print', 'Kargo etiketi yazdır', 'Print or download shipping labels', 'Sipariş & Sevkiyat'),
  P('shipments.handover', 'Kargoya teslim', 'Hand parcels to the courier and print the manifest', 'Sipariş & Sevkiyat'),

  // ---- Entegrasyon ----
  P('integrations.read', 'Entegrasyonları gör', 'View integrations and their settings (secrets masked)', 'Entegrasyon'),
  P('integrations.manage', 'Entegrasyon yönet', 'Manage third-party integrations', 'Entegrasyon'),
  P('integrations.settings.update', 'Entegrasyon ayarları', 'Change, reset or restore integration settings', 'Entegrasyon'),
  P('integrations.sync', 'Senkron başlat', 'Trigger manual price, stock and order synchronisation', 'Entegrasyon'),
  P('integration.logs.read', 'Entegrasyon loglarını gör', 'View integration error logs', 'Entegrasyon'),
  P('integration.logs.manage', 'Entegrasyon loglarını yönet', 'Resolve, ignore or retry integration errors', 'Entegrasyon'),
  P('agent.read', "Agent'ları gör", 'View KroptOS Agents and their job queue', 'Entegrasyon'),
  P('agent.manage', "Agent'ları yönet", 'Generate enrollment codes, assign and revoke KroptOS Agents', 'Entegrasyon'),

  // ---- Muhasebe ----
  P('accounting.read', 'Muhasebeyi gör', 'View accounting integrations and documents', 'Muhasebe'),
  P('accounting.manage', 'Muhasebe yönet', 'Manage accounting integrations, companies, and emit invoices', 'Muhasebe'),
  P('accounting.export', 'Muhasebe dışa aktar', 'Export financial/invoice reports', 'Muhasebe', true),
  P('accounting.documents.read', 'Belgeleri gör', 'View accounting documents', 'Muhasebe', true),
  P('accounting.documents.create', 'Belge oluştur', 'Create accounting invoice and payment documents', 'Muhasebe', true),
  P('accounting.credential.manage', 'ERP kimlik bilgisi', 'Submit ERP credentials to an Agent (end-to-end encrypted envelope)', 'Muhasebe'),
  P('accounting.invoice.push', 'Faturayı ERP’ye gönder', 'Push invoices to ERP via the Agent route', 'Muhasebe', true),

  // ---- Analitik ----
  P('analytics.read', 'Analitiği gör', 'View analytics dashboards and reports', 'Analitik'),
  P('analytics.export', 'Analitik dışa aktar', 'Export analytics reports', 'Analitik'),
  P('analytics.financial.read', 'Finansal analitik', 'View profitability and financial analytics', 'Analitik'),
  P('analytics.integration.read', 'Entegrasyon analitiği', 'View integration health and accounting analytics', 'Analitik'),
] as const;

export type PermissionKey = (typeof PERMISSIONS)[number]['key'];
export const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key) as PermissionKey[];

export function isPermissionKey(value: string): value is PermissionKey {
  return (PERMISSION_KEYS as string[]).includes(value);
}

export interface RoleDef {
  key: string;
  name: string;
  description: string;
  permissions: PermissionKey[];
}

/** Dokuz sistem rolü (isSystem = true, agencyId = null). Seed bunu yazar. */
export const DEFAULT_ROLES: RoleDef[] = [
  {
    key: 'super_admin',
    name: 'super_admin',
    description: 'Super administrator with full system-wide access',
    permissions: ['*:*'],
  },
  {
    key: 'agency_owner',
    name: 'agency_owner',
    description: 'Agency owner with full management rights inside their agency',
    permissions: [
      'agencies.read',
      'clients.read', 'clients.create', 'clients.write',
      'stores.read', 'stores.create', 'stores.write',
      'users.view', 'users.manage', 'roles.view', 'roles.manage',
      'products.read', 'products.create', 'products.update', 'products.delete',
      'orders.read', 'orders.update', 'orders.cancel',
      'integrations.manage', 'integrations.read', 'integrations.settings.update', 'integrations.sync',
      'accounting.export', 'accounting.read', 'accounting.manage', 'accounting.documents.read', 'accounting.documents.create',
      'accounting.credential.manage', 'accounting.invoice.push',
      'agent.read', 'agent.manage',
      'warehouse.manage',
      'wms.view', 'wms.manage', 'wms.print', 'wms.settings.update', 'wms.labels.view', 'wms.labels.create', 'wms.stock.view', 'wms.stock.update',
      'analytics.read', 'analytics.export', 'analytics.financial.read', 'analytics.integration.read',
      'system.settings.read', 'system.settings.manage', 'system.settings.write',
      'warehouse.settings.read', 'warehouse.settings.manage',
      'stock.allocation.read', 'stock.allocation.manage',
      'audit.read',
      'integration.logs.read', 'integration.logs.manage',
      'carriers.read', 'carriers.create', 'carriers.update', 'carriers.delete',
      'shipments.read', 'shipments.create', 'shipments.cancel', 'shipments.label.print', 'shipments.handover',
    ],
  },
  {
    key: 'agency_admin',
    name: 'agency_admin',
    description: 'Agency admin helping to manage clients and stores',
    permissions: [
      'agencies.read',
      'clients.read', 'clients.create',
      'stores.read', 'stores.create',
      'users.view', 'users.manage', 'roles.view', 'roles.manage',
      'products.read', 'products.create', 'products.update', 'products.delete',
      'orders.read', 'orders.update', 'orders.cancel',
      'integrations.read', 'integrations.settings.update', 'integrations.sync',
      'wms.view', 'wms.print', 'wms.labels.view', 'wms.stock.view',
      'analytics.read', 'analytics.integration.read',
      'system.settings.read',
      // agency_admin ajans icindeki kullanici/magaza yonetimine yardim eden rol;
      // denetim kaydini gorememesi bu rolun varlik sebebiyle celisiyordu.
      'audit.read',
      'integration.logs.read', 'integration.logs.manage',
      'carriers.read',
      'shipments.read',
    ],
  },
  {
    key: 'client_admin',
    name: 'client_admin',
    description: 'Client administrator managing stores, products, and orders',
    permissions: [
      'clients.read',
      'stores.read', 'stores.create',
      'products.read', 'products.create', 'products.update', 'products.delete',
      'orders.read', 'orders.update', 'orders.cancel',
      'integrations.read', 'integrations.sync',
      'wms.view', 'wms.manage', 'wms.print', 'wms.settings.update', 'wms.labels.view', 'wms.labels.create', 'wms.stock.view', 'wms.stock.update',
      'analytics.read',
      'warehouse.settings.read', 'warehouse.settings.manage',
      'stock.allocation.read',
      'carriers.read', 'carriers.create', 'carriers.update', 'carriers.delete',
      'shipments.read', 'shipments.create', 'shipments.cancel', 'shipments.label.print', 'shipments.handover',
    ],
  },
  {
    key: 'store_manager',
    name: 'store_manager',
    description: 'Store manager focusing on operational products and orders',
    permissions: [
      'stores.read',
      'products.read', 'products.create', 'products.update', 'products.delete',
      'orders.read', 'orders.update', 'orders.cancel',
      'wms.view', 'wms.print', 'wms.labels.view', 'wms.stock.view', 'wms.stock.update',
      'carriers.read',
      'shipments.read', 'shipments.create', 'shipments.label.print', 'shipments.handover',
    ],
  },
  {
    key: 'accountant',
    name: 'accountant',
    description: 'Accountant checking billing, financials, and exporting report audits',
    permissions: ['stores.read', 'orders.read', 'accounting.export', 'analytics.read', 'analytics.export', 'analytics.financial.read'],
  },
  {
    key: 'warehouse_staff',
    name: 'warehouse_staff',
    description: 'Warehouse staff managing stock levels and fulfillments',
    permissions: [
      // stores.read: GET /api/stores artik izin istiyor (P4); depo personeli magaza listesini gorebilmeli
      'stores.read',
      'products.read',
      'orders.read',
      'warehouse.manage',
      'wms.view', 'wms.print', 'wms.labels.view', 'wms.labels.create', 'wms.stock.view', 'wms.stock.update',
      'warehouse.settings.read',
      'stock.allocation.read',
      'carriers.read',
      'shipments.read', 'shipments.create', 'shipments.label.print', 'shipments.handover',
    ],
  },
  {
    key: 'support',
    name: 'support',
    description: 'Customer support staff reading issues, tickets, and order logs',
    permissions: ['clients.read', 'stores.read', 'orders.read'],
  },
  {
    key: 'viewer',
    name: 'viewer',
    description: 'Read-only profile context viewer',
    permissions: ['agencies.read', 'clients.read', 'stores.read', 'products.read', 'orders.read'],
  },
];

export const SYSTEM_ROLE_KEYS = DEFAULT_ROLES.map((r) => r.key);
