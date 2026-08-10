'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import { apiFetch } from '@/lib/api';

const fetcher = (url: string) => apiFetch<any>(url);

interface IntegrationSettingsRow {
  id: string;
  provider: string;
  status: string;
  isActive: boolean;
  lastSyncAt: string | null;
  errorCount: number;
}

function formatLastSync(value: string | null) {
  if (!value) return 'Hiç senkronize edilmedi';
  return new Date(value).toLocaleString('tr-TR');
}

/**
 * Read-only mirror of the integrations page.
 *
 * This screen used to own its own `IntegrationSettings` rows and its own
 * credential form, which is why a marketplace connected under /integrations
 * stayed "Disconnected" here forever — nothing joined the two. The rows are now
 * derived from `Integration`, so the state shown is the real one, and the
 * editing path lives in one place instead of two.
 */
export function IntegrationSettingsGrid() {
  const params = useParams();
  const tenantPublicId = params?.tenantPublicId as string | undefined;
  const integrationsHref = tenantPublicId ? `/t/${tenantPublicId}/integrations` : '/integrations';

  const { data: integrations, error } = useSWR<IntegrationSettingsRow[]>(
    '/system/integration-settings',
    fetcher,
  );

  if (error) return <div className="text-red-500">Failed to load integration settings.</div>;
  if (!integrations) return <div className="animate-pulse h-64 bg-gray-100 rounded-lg"></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-medium leading-6 text-gray-900">
            Marketplace &amp; ERP Integrations
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Bağlı kanallarınızın güncel durumu. Bağlantı kurmak, ayarlamak veya kaldırmak için
            Entegrasyon Merkezi&apos;ni kullanın.
          </p>
        </div>

        <Link
          href={integrationsHref}
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
        >
          Entegrasyon Merkezi
          <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {integrations.map((item) => {
          const isConnected = item.status === 'connected';
          const hasFailed = item.status === 'failed';

          return (
            <div
              key={item.id}
              className="card flex flex-col justify-between border border-gray-200 rounded-xl p-5 bg-white shadow-sm"
            >
              <div>
                <div className="flex justify-between items-start gap-2">
                  <span className="text-sm font-bold text-gray-900 capitalize">{item.provider}</span>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${
                      isConnected
                        ? 'bg-emerald-50 text-emerald-700'
                        : hasFailed
                          ? 'bg-red-50 text-red-700'
                          : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isConnected ? 'bg-emerald-600' : hasFailed ? 'bg-red-600' : 'bg-gray-400'
                      }`}
                    ></span>
                    {isConnected ? 'Connected' : hasFailed ? 'Failed' : 'Disconnected'}
                  </span>
                </div>

                <p className="text-xs text-gray-400 mt-2">
                  {item.provider === 'logo' || item.provider === 'logo_erp'
                    ? 'Integrate with Logo Tiger/Go ERP systems.'
                    : `Synchronize products and orders with ${item.provider}.`}
                </p>

                <dl className="mt-3 space-y-1 text-xs text-gray-500">
                  <div className="flex justify-between gap-2">
                    <dt>Son senkronizasyon</dt>
                    <dd className="font-medium text-gray-700">{formatLastSync(item.lastSyncAt)}</dd>
                  </div>
                  {item.errorCount > 0 && (
                    <div className="flex justify-between gap-2">
                      <dt>Başarısız iş</dt>
                      <dd className="font-medium text-red-600">{item.errorCount}</dd>
                    </div>
                  )}
                </dl>
              </div>

              <div className="mt-5 pt-4 border-t border-gray-50">
                <Link
                  href={integrationsHref}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                >
                  {isConnected || hasFailed ? 'Yönet' : 'Bağlantı kur'} →
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
