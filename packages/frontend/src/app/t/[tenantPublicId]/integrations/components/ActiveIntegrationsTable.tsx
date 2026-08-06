'use client';

import {
  Cog6ToothIcon,
  TrashIcon,
  ArrowPathIcon,
  BuildingStorefrontIcon,
  ShoppingBagIcon,
  TruckIcon,
  CpuChipIcon,
  DocumentTextIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

export interface ActiveIntegrationItem {
  id: string;
  name: string;
  provider: string;
  providerType: string;
  status: string;
  lastSyncAt?: string;
  setting?: { isConfigured: boolean; completedSteps: string[] } | null;
}

interface ActiveIntegrationsTableProps {
  items: ActiveIntegrationItem[];
  onOpenSettings: (item: ActiveIntegrationItem) => void;
  onSync: (id: string) => void;
  onDelete: (id: string) => void;
  syncingId: string | null;
}

export function ActiveIntegrationsTable({
  items,
  onOpenSettings,
  onSync,
  onDelete,
  syncingId,
}: ActiveIntegrationsTableProps) {
  if (items.length === 0) return null;

  const getTypeBadge = (providerType: string, provider: string) => {
    const type = (providerType || provider).toLowerCase();

    if (type.includes('marketplace') || ['trendyol', 'hepsiburada', 'amazon', 'n11', 'ciceksepeti'].includes(type)) {
      return {
        label: 'Pazaryeri',
        icon: BuildingStorefrontIcon,
        className: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
      };
    }
    if (type.includes('erp') || ['logo', 'mikro', 'netsis', 'nebim'].includes(type)) {
      return {
        label: 'ERP & Stok',
        icon: CpuChipIcon,
        className: 'bg-sky-500/10 text-sky-600 border-sky-500/20',
      };
    }
    if (type.includes('shipping') || ['yurtici', 'aras', 'mng', 'sendeo'].includes(type)) {
      return {
        label: 'Kargo',
        icon: TruckIcon,
        className: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
      };
    }
    if (type.includes('accounting') || ['parasut', 'bizimhesap'].includes(type)) {
      return {
        label: 'E-Fatura',
        icon: DocumentTextIcon,
        className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
      };
    }
    return {
      label: 'E-Ticaret',
      icon: ShoppingBagIcon,
      className: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
    };
  };

  return (
    <div className="w-full rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden animate-fade-in">
      {/* Table Header Section Title Bar */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3.5 text-white flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider font-mono">
          Entegrasyon Ayarları & Canlı Veri Akışları
        </h3>
        <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[0.6875rem] font-bold">
          {items.length} Aktif Bağlantı
        </span>
      </div>

      {/* Table Content */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-[0.6875rem] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <tr>
              <th className="px-6 py-3.5">TİP</th>
              <th className="px-6 py-3.5">ENTEGRASYON ADI</th>
              <th className="px-6 py-3.5">İNEN VERİLER (ALINAN)</th>
              <th className="px-6 py-3.5">GÖNDERİLEN VERİLER (AKTARILAN)</th>
              <th className="px-6 py-3.5 text-right">İŞLEMLER</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium text-slate-700 dark:text-slate-200">
            {items.map((item) => {
              const typeInfo = getTypeBadge(item.providerType, item.provider);
              const TypeIcon = typeInfo.icon;
              const isSyncing = syncingId === item.id;

              return (
                <tr
                  key={item.id}
                  className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                >
                  {/* Type Badge */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[0.6875rem] font-bold ${typeInfo.className}`}>
                      <TypeIcon className="h-3.5 w-3.5" />
                      {item.provider.toUpperCase()}
                    </span>
                  </td>

                  {/* Integration Name */}
                  <td className="px-6 py-4 whitespace-nowrap font-bold text-slate-900 dark:text-white">
                    {item.name}
                  </td>

                  {/* Downloaded Data Badges (İnen Veriler) */}
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-2 py-0.5 text-[0.6875rem] font-bold">
                        <CheckCircleIcon className="h-3 w-3" />
                        Siparişler (1dk)
                      </span>
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-2 py-0.5 text-[0.6875rem] font-bold">
                        Ürünler
                      </span>
                    </div>
                  </td>

                  {/* Sent Data Badges (Gönderilen Veriler) */}
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-2 py-0.5 text-[0.6875rem] font-bold">
                        Stok (5dk)
                      </span>
                      <span className="inline-flex items-center gap-1 rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700 px-2 py-0.5 text-[0.6875rem] font-bold">
                        Fiyatlar
                      </span>
                      <span className="inline-flex items-center gap-1 rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700 px-2 py-0.5 text-[0.6875rem] font-bold">
                        Kargo Takip No
                      </span>
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => onSync(item.id)}
                        disabled={isSyncing}
                        title="Manuel Senkronizasyon Başlat"
                        className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
                      >
                        <ArrowPathIcon className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin text-blue-600' : ''}`} />
                        <span>Senkronize Et</span>
                      </button>

                      <button
                        onClick={() => onOpenSettings(item)}
                        title="Entegrasyon Ayarları"
                        className="flex items-center gap-1.5 rounded-lg bg-blue-600 text-white px-2.5 py-1.5 text-xs font-semibold hover:bg-blue-700 shadow-xs transition-all"
                      >
                        <Cog6ToothIcon className="h-3.5 w-3.5" />
                        <span>Ayarlar</span>
                      </button>

                      <button
                        onClick={() => onDelete(item.id)}
                        title="Entegrasyonu Sil"
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 transition-colors"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
