'use client';

import {
  Cog6ToothIcon,
  TrashIcon,
  ArrowPathIcon,
  BuildingStorefrontIcon,
  ShoppingBagIcon,
  TruckIcon,
  DocumentTextIcon,
  Squares2X2Icon,
  BeakerIcon,
} from '@heroicons/react/24/outline';
import type { IntegrationStatus } from '@kroptos/shared';

export interface ActiveIntegrationItem {
  id: string;
  name: string;
  provider: string;
  providerType: string;
  status: IntegrationStatus;
  lastSyncAt?: string;
  store?: { id: string; name: string } | null;
  setting?: { isConfigured: boolean; completedSteps: string[] } | null;
  /**
   * Whether this integration talks to the marketplace or serves its connector's
   * own sample data. Resolved by the backend, never guessed here: a simulated
   * integration that looks identical to a live one is how invented orders get
   * believed.
   */
  mode?: 'live' | 'simulation';
  modeSource?: 'setting' | 'env' | 'default';
}

interface ActiveIntegrationsTableProps {
  items: ActiveIntegrationItem[];
  onOpenSettings: (item: ActiveIntegrationItem) => void;
  onSync: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleStatus: (item: ActiveIntegrationItem) => void;
  syncingId: string | null;
  togglingId: string | null;
}

function getTypeInfo(providerType: string, provider: string) {
  const type = (providerType || provider).toLowerCase();

  if (type.includes('marketplace') || ['trendyol', 'hepsiburada', 'amazon', 'n11', 'ciceksepeti'].includes(type)) {
    return { label: 'Pazaryeri', icon: BuildingStorefrontIcon, className: 'bg-blue-500/10 text-blue-600 border-blue-500/20' };
  }
  if (type.includes('erp') || type.includes('accounting') || ['logo', 'mikro', 'netsis', 'nebim', 'parasut', 'bizimhesap', 'kolaybi'].includes(type)) {
    return { label: 'Muhasebe Entegrasyonu', icon: DocumentTextIcon, className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' };
  }
  if (
    type.includes('shipping') ||
    type.includes('carrier') ||
    [
      'yurtici', 'aras', 'mng', 'sendeo', 'hepsijet', 'dhl', 'dpd', 'gls',
      'ups', 'inpost', 'postnl', 'royal_mail', 'evri', 'colissimo',
      'chronopost', 'sameday', 'fan_courier', 'cargus', 'packeta', 'pocztex',
    ].includes(type)
  ) {
    return { label: 'Kargo & Lojistik', icon: TruckIcon, className: 'bg-orange-500/10 text-orange-600 border-orange-500/20' };
  }
  return { label: 'E-Ticaret', icon: ShoppingBagIcon, className: 'bg-purple-500/10 text-purple-600 border-purple-500/20' };
}

/** Relative "x ago" label for the last successful sync; null when never synced. */
function formatLastSync(lastSyncAt?: string): string | null {
  if (!lastSyncAt) return null;
  const then = new Date(lastSyncAt).getTime();
  if (Number.isNaN(then)) return null;

  const diffMinutes = Math.floor((Date.now() - then) / 60000);
  if (diffMinutes < 1) return 'az önce senkronize edildi';
  if (diffMinutes < 60) return `${diffMinutes} dk önce senkronize edildi`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} sa önce senkronize edildi`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} gün önce senkronize edildi`;
}

export function ActiveIntegrationsTable({
  items,
  onOpenSettings,
  onSync,
  onDelete,
  onToggleStatus,
  syncingId,
  togglingId,
}: ActiveIntegrationsTableProps) {
  const activeCount = items.filter((item) => item.status === 'active').length;

  return (
    <div className="w-full rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden animate-fade-in">
      {/* Section title bar */}
      <div className="bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-3.5 text-slate-700 dark:text-slate-200 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider font-mono">Bağlı Entegrasyonlar</h3>
        {items.length > 0 && (
          <span className="rounded-full bg-slate-200 dark:bg-slate-700 px-2.5 py-0.5 text-[0.6875rem] font-bold">
            {activeCount} aktif / {items.length} bağlantı
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
          <Squares2X2Icon className="h-8 w-8 text-slate-300 dark:text-slate-700" />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            Henüz bağlı entegrasyon yok
          </p>
          <p className="max-w-md text-xs text-slate-500 dark:text-slate-400">
            Yukarıdaki &quot;Entegrasyon Ekle&quot; butonuyla pazaryeri, ERP veya kargo bağlantısı kurun.
            Kurduğunuz her bağlantı burada tek satır olarak listelenir.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-200 dark:divide-slate-800">
          {items.map((item) => {
            const typeInfo = getTypeInfo(item.providerType, item.provider);
            const TypeIcon = typeInfo.icon;
            const isSyncing = syncingId === item.id;
            const isToggling = togglingId === item.id;
            const isActive = item.status === 'active';
            const hasError = item.status === 'error';
            const lastSync = formatLastSync(item.lastSyncAt);

            return (
              <li
                key={item.id}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
              >
                {/* Provider type */}
                <span
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 text-[0.6875rem] font-bold ${typeInfo.className}`}
                  title={typeInfo.label}
                >
                  <TypeIcon className="h-3.5 w-3.5" />
                  {item.provider.toUpperCase()}
                </span>

                {/* Name + store badge */}
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="truncate text-xs font-bold text-slate-900 dark:text-white">
                    {item.name}
                  </span>
                  {item.store?.name && (
                    <span
                      className="inline-flex shrink-0 items-center gap-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 text-[0.6875rem] font-semibold text-slate-600 dark:text-slate-300"
                      title="Bağlı mağaza"
                    >
                      <BuildingStorefrontIcon className="h-3 w-3" />
                      {item.store.name}
                    </span>
                  )}
                  {item.mode === 'simulation' && (
                    <span
                      className="inline-flex shrink-0 items-center gap-1 rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[0.6875rem] font-bold text-amber-700 dark:text-amber-400"
                      title={
                        'Simülasyon modu: pazaryerine istek gönderilmez, üretilen sipariş ve ürünler örnektir ' +
                        've veritabanına yazılmaz.' +
                        (item.modeSource === 'env'
                          ? ' (Sunucu ayarı MARKETPLACE_MODE ile seçildi.)'
                          : item.modeSource === 'default'
                            ? ' (Sağlayıcının uçları henüz doğrulanmadı.)'
                            : '')
                      }
                    >
                      <BeakerIcon className="h-3 w-3" />
                      Simülasyon
                    </span>
                  )}
                </div>

                {/* Last sync */}
                <span className="hidden shrink-0 text-[0.6875rem] font-medium text-slate-400 dark:text-slate-500 lg:block">
                  {lastSync ?? 'Hiç senkronize edilmedi'}
                </span>

                {/* Active / passive switch */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={isActive}
                  aria-label={`${item.name} entegrasyonunu ${isActive ? 'pasifleştir' : 'aktifleştir'}`}
                  onClick={() => onToggleStatus(item)}
                  disabled={isToggling}
                  title={
                    hasError
                      ? 'Bu entegrasyon hata durumunda. Aktifleştirmek için tıklayın.'
                      : isActive
                        ? 'Aktif — pasifleştirmek için tıklayın'
                        : 'Pasif — senkronizasyon durdu, aktifleştirmek için tıklayın'
                  }
                  className="flex shrink-0 items-center gap-2 disabled:opacity-50"
                >
                  <span
                    className={`relative h-4 w-8 rounded-full transition-colors ${
                      isActive ? 'bg-emerald-500' : hasError ? 'bg-red-400' : 'bg-slate-300 dark:bg-slate-600'
                    }`}
                  >
                    <span
                      className={`absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-white shadow-xs transition-transform ${
                        isActive ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </span>
                  <span
                    className={`w-10 text-left text-[0.6875rem] font-bold ${
                      isActive
                        ? 'text-emerald-600'
                        : hasError
                          ? 'text-red-600'
                          : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {hasError ? 'Hata' : isActive ? 'Aktif' : 'Pasif'}
                  </span>
                </button>

                {/* Actions */}
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => onSync(item.id)}
                    disabled={isSyncing || !isActive}
                    title={isActive ? 'Manuel senkronizasyon başlat' : 'Pasif entegrasyon senkronize edilemez'}
                    className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-40 disabled:hover:bg-white dark:disabled:hover:bg-slate-800"
                  >
                    <ArrowPathIcon className={`h-4 w-4 ${isSyncing ? 'animate-spin text-blue-600' : ''}`} />
                  </button>

                  <button
                    onClick={() => onOpenSettings(item)}
                    title="Entegrasyon ayarları"
                    className="flex items-center gap-1.5 rounded-lg bg-blue-600 text-white px-2.5 py-1.5 text-[0.6875rem] font-bold hover:bg-blue-700 shadow-xs transition-all"
                  >
                    <Cog6ToothIcon className="h-3.5 w-3.5" />
                    <span>Ayarlar</span>
                  </button>

                  <button
                    onClick={() => onDelete(item.id)}
                    title="Entegrasyonu sil"
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 transition-colors"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
