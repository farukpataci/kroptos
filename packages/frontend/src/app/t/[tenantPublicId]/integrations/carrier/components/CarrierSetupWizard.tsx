'use client';

import { useState } from 'react';
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  KeyIcon,
  TruckIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { carrierPayload } from '../carrierPayload';
import type { CarrierConnection, CarrierProviderOption, ConnectionTestResult } from '../types';

interface Props {
  provider: CarrierProviderOption;
  presetName: string;
  onClose: () => void;
  onCreated: (connection: CarrierConnection) => void;
}

export function CarrierSetupWizard({ provider, presetName, onClose, onCreated }: Props) {
  const toast = useToast();

  const [displayName, setDisplayName] = useState(presetName || provider.provider);
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [isTestMode, setIsTestMode] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fields = provider.requiredFields ?? [];

  const handleConnectAndTest = async () => {
    if (!displayName.trim()) {
      setError('Lütfen entegrasyon adı girin.');
      return;
    }

    // Check required credentials
    const missing = fields.filter((f) => !credentials[f.name]?.trim());
    if (missing.length > 0) {
      setError(`Lütfen zorunlu alanları doldurun: ${missing.map((m) => m.name).join(', ')}`);
      return;
    }

    setIsBusy(true);
    setError(null);

    try {
      const payload = carrierPayload(
        {
          provider: provider.provider,
          displayName,
          credentials,
          isActive: true,
          isTestMode,
          senderAddress: {},
          settings: { labelFormat: 'PDF', desiDivisor: '3000', cutoffTime: '17:00', defaultServiceLevel: 'standard' },
        },
        'create',
      );

      // 1. Create Carrier Connection
      const created = await apiFetch<CarrierConnection>('/carriers', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      // 2. Test Connection immediately
      let testResult: ConnectionTestResult | null = null;
      try {
        testResult = await apiFetch<ConnectionTestResult>(`/carriers/${created.id}/test`, {
          method: 'POST',
        });
      } catch {
        // Non-fatal if initial test fails, row is still created
      }

      if (testResult && !testResult.success) {
        toast.warning(testResult.message || `${displayName} bağlantı testi başarısız oldu, ancak kaydoldu.`);
      } else {
        toast.success(testResult?.message || `${displayName} bağlantısı başarıyla kuruldu ve doğrulandı.`);
      }

      onCreated(created);
    } catch (err: any) {
      setError(err?.message || 'Kargo bağlantısı oluşturulurken hata meydana geldi.');
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl animate-scale-in">
        {/* Header + Progress */}
        <header className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white font-bold text-sm">
                <TruckIcon className="h-5 w-5 stroke-[2.5]" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  {displayName} Kurulumu
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Adım 1 / 2 — API Kimlik Bilgilerini Tanımlama
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-4 h-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
            <div className="h-full rounded-full bg-blue-600 transition-all w-1/2" />
          </div>
        </header>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-50 dark:bg-red-950/40 p-3.5 text-xs font-medium text-red-600 dark:text-red-400">
              <ExclamationTriangleIcon className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Integration Name */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
              Entegrasyon Adı <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
              placeholder="Örn: MNG Kargo Ana Mağaza"
            />
          </div>

          {/* Credentials Card Section */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-4 space-y-4">
            <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <KeyIcon className="h-4 w-4 text-blue-600" />
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white">API Bilgileri</h3>
                <p className="text-[0.6875rem] text-slate-500">
                  {provider.provider} panelinizden aldığınız erişim bilgilerini girin.
                </p>
              </div>
            </div>

            {fields.length === 0 ? (
              <p className="text-xs text-slate-500">Bu kargo sağlayıcısı için ek kimlik bilgisi gerekmiyor.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {fields.map((field) => (
                  <div key={field.name} className="space-y-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                      {field.name} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type={field.secret ? 'password' : 'text'}
                      value={credentials[field.name] ?? ''}
                      onChange={(e) =>
                        setCredentials((prev) => ({ ...prev, [field.name]: e.target.value }))
                      }
                      placeholder={`${field.name} giriniz`}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="pt-2">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isTestMode}
                  onChange={(e) => setIsTestMode(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>Test / Sandbox Modu Kullan (Önerilen)</span>
              </label>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="flex items-center justify-between gap-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-300 dark:border-slate-700 px-4 py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            Kapat
          </button>

          <button
            type="button"
            onClick={handleConnectAndTest}
            disabled={isBusy}
            className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 text-xs font-bold shadow-md shadow-blue-500/20 transition-all hover:scale-[1.02] disabled:opacity-50"
          >
            {isBusy ? (
              <>
                <ArrowPathIcon className="h-4 w-4 animate-spin" />
                <span>Bağlanıyor...</span>
              </>
            ) : (
              <>
                <CheckCircleIcon className="h-4 w-4 stroke-[2.5]" />
                <span>Bağlan ve Test Et</span>
              </>
            )}
          </button>
        </footer>
      </div>
    </div>
  );
}
