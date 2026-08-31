'use client';

import { useEffect, useState } from 'react';
import {
  ArrowPathIcon,
  BoltIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  LockClosedIcon,
  TruckIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useTranslations } from 'next-intl';
import { CREDENTIAL_MASK } from '@kroptos/shared';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { carrierPayload, CarrierFormState } from '../carrierPayload';
import type { CarrierConnection, CarrierProviderOption, ConnectionTestResult } from '../types';

interface Props {
  /** The connection being edited, or draft object ({ id: '', provider: 'YURTICI', ... }) for a new one. */
  connection: CarrierConnection | null;
  providers: CarrierProviderOption[];
  onClose: () => void;
  onSaved: () => void;
}

const LABEL_FORMATS = ['PDF', 'ZPL', 'PNG', 'HTML'];
const SERVICE_LEVELS = ['standard', 'express', 'same_day', 'freight'];
const ADDRESS_FIELDS = [
  'fullName',
  'phone',
  'line1',
  'line2',
  'district',
  'city',
  'postalCode',
  'countryCode',
];

const inputClass =
  'w-full rounded-kp-md border border-kp-border bg-kp-bg-primary px-3 py-2 text-theme-sm text-kp-text-primary placeholder-kp-text-tertiary focus:outline-hidden';
const buttonClass =
  'flex items-center gap-2 rounded-kp-md border border-kp-border px-3 py-2 text-xs font-semibold text-kp-text-secondary transition-all hover:bg-kp-bg-hover disabled:opacity-40';

function initialState(
  connection: CarrierConnection | null,
  providers: CarrierProviderOption[],
): CarrierFormState {
  const address = (connection?.senderAddress ?? {}) as Record<string, string>;
  const settings = (connection?.settings ?? {}) as Record<string, unknown>;

  const defaultProvider = connection?.provider || providers[0]?.provider || '';
  const defaultDisplayName = connection?.displayName || defaultProvider;

  return {
    provider: defaultProvider,
    displayName: defaultDisplayName,
    credentials: { ...((connection?.credentials ?? {}) as Record<string, string>) },
    isActive: connection?.isActive ?? true,
    isTestMode: connection?.isTestMode ?? true,
    senderAddress: Object.fromEntries(ADDRESS_FIELDS.map((key) => [key, address[key] ?? ''])),
    settings: {
      labelFormat: String(settings.labelFormat ?? 'PDF'),
      desiDivisor: settings.desiDivisor == null ? '3000' : String(settings.desiDivisor),
      cutoffTime: String(settings.cutoffTime ?? '17:00'),
      defaultServiceLevel: String(settings.defaultServiceLevel ?? 'standard'),
    },
  };
}

export default function CarrierConnectionDrawer({ connection, providers, onClose, onSaved }: Props) {
  const t = useTranslations('carriers');
  const toast = useToast();
  const [form, setForm] = useState<CarrierFormState>(() => initialState(connection, providers));
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditMode = Boolean(connection && connection.id);

  useEffect(() => {
    setForm(initialState(connection, providers));
    setError(null);
  }, [connection, providers]);

  const mode = isEditMode ? 'update' : 'create';
  const fields = providers.find((p) => p.provider.toUpperCase() === form.provider.toUpperCase())?.requiredFields ?? [];

  const setCredential = (name: string, value: string) =>
    setForm((prev) => ({ ...prev, credentials: { ...prev.credentials, [name]: value } }));

  const setAddress = (name: string, value: string) =>
    setForm((prev) => ({ ...prev, senderAddress: { ...prev.senderAddress, [name]: value } }));

  const testConnection = async () => {
    if (!connection?.id) {
      toast.info('Bağlantı kurulduktan sonra otomatik olarak test edilecektir.');
      return;
    }
    setIsTesting(true);
    try {
      const result = await api.post<ConnectionTestResult>(`/api/carriers/${connection.id}/test`);
      if (result.success) {
        toast.success(result.message || 'Kargo bağlantı testi başarılı.');
      } else {
        toast.error(result.message || 'Kargo bağlantı testi başarısız.');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Bağlantı testi sırasında hata oluştu.');
    } finally {
      setIsTesting(false);
    }
  };

  const save = async () => {
    if (!form.displayName.trim()) {
      setError(t('form.displayNameRequired') || 'Lütfen bağlantı adı girin.');
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const body = carrierPayload(form, mode);
      let savedRow: any = null;

      if (isEditMode && connection?.id) {
        savedRow = await api.patch(`/api/carriers/${connection.id}`, body);
        toast.success(`${form.displayName} bağlantı ayarları güncellendi.`);
      } else {
        savedRow = await api.post('/api/carriers', body);
        toast.success(`${form.displayName} bağlantısı başarıyla kuruldu.`);
        // Test connection on newly created carrier
        if (savedRow?.id) {
          try {
            const testRes = await api.post<ConnectionTestResult>(`/api/carriers/${savedRow.id}/test`);
            if (testRes.success) {
              toast.success(testRes.message || `${form.displayName} bağlantı testi başarılı.`);
            }
          } catch {
            // Ignore failure on initial test after save
          }
        }
      }
      onSaved();
    } catch (e: any) {
      setError(e?.message || t('errors.save') || 'Bağlantı kaydedilemedi.');
    } finally {
      setIsSaving(false);
    }
  };

  const carrierTitle = form.displayName || form.provider || 'Kargo Entegrasyonu';

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-2xl flex-col border-l border-kp-border bg-kp-bg-secondary shadow-2xl animate-slide-in-right overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-shrink-0 items-center justify-between border-b border-kp-border bg-slate-900/40 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/10 text-blue-600 border border-blue-500/20">
              <TruckIcon className="h-5 w-5 stroke-[2.5]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-kp-text-primary">
                {isEditMode ? `${carrierTitle} Ayarları` : `${carrierTitle} Bağlantısı Kur`}
              </h2>
              <p className="mt-0.5 text-xs text-kp-text-tertiary">
                {isEditMode
                  ? 'Kimlik bilgileri, gönderici adresi ve kargo etiket ayarlarını yönetin.'
                  : `${carrierTitle} hesabınızın API / Web Servis bilgilerini tanımlayarak entegrasyonu tamamlayın.`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            title={t('form.close') || 'Kapat'}
            className="rounded-kp-sm p-1.5 text-kp-text-tertiary transition-colors hover:bg-kp-bg-tertiary hover:text-kp-text-primary"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
          {error && (
            <div className="flex items-center gap-2 rounded-kp-md border border-kp-danger/40 bg-kp-danger-muted px-3.5 py-2 text-theme-sm text-kp-danger">
              <ExclamationTriangleIcon className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Provider Info Card */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[0.6875rem] font-semibold uppercase tracking-wider text-kp-text-tertiary">
                Taşıyıcı Sağlayıcı
              </h3>
              {isEditMode && (
                <button
                  type="button"
                  onClick={testConnection}
                  disabled={isTesting}
                  className="flex items-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1 text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-100 transition-all"
                >
                  <BoltIcon className={`h-3.5 w-3.5 ${isTesting ? 'animate-pulse' : ''}`} />
                  <span>{isTesting ? 'Test Ediliyor...' : 'Bağlantıyı Test Et'}</span>
                </button>
              )}
            </div>

            <div className="flex items-center justify-between rounded-xl border border-kp-border bg-slate-50 dark:bg-slate-900/60 p-3.5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white font-bold text-xs uppercase">
                  {form.provider.slice(0, 3)}
                </div>
                <div>
                  <h4 className="text-sm font-bold text-kp-text-primary">{form.displayName}</h4>
                  <p className="font-mono text-[0.6875rem] uppercase text-kp-text-tertiary">{form.provider}</p>
                </div>
              </div>
              <span className="flex items-center gap-1 text-[0.6875rem] font-semibold text-slate-500 bg-slate-200/60 dark:bg-slate-800 px-2.5 py-1 rounded-md">
                <LockClosedIcon className="h-3 w-3" />
                Sağlayıcı Kilitli
              </span>
            </div>

            <label className="block space-y-1">
              <span className="text-xs text-kp-text-secondary">Bağlantı Görüntülenme Adı</span>
              <input
                type="text"
                value={form.displayName}
                onChange={(e) => setForm((prev) => ({ ...prev, displayName: e.target.value }))}
                className={inputClass}
                placeholder="Örn: Yurtiçi Kargo Ana Mağaza"
              />
            </label>

            <div className="flex flex-wrap gap-4 pt-1">
              <label className="flex items-center gap-2 text-theme-sm text-kp-text-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                  className="rounded border-kp-border text-blue-600 focus:ring-blue-500"
                />
                <span className="font-medium text-xs">Entegrasyon Aktif</span>
              </label>
              <label className="flex items-center gap-2 text-theme-sm text-kp-text-secondary cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isTestMode}
                  onChange={(e) => setForm((prev) => ({ ...prev, isTestMode: e.target.checked }))}
                  className="rounded border-kp-border text-amber-600 focus:ring-amber-500"
                />
                <span className="font-medium text-xs">Test / Sandbox Modu</span>
              </label>
            </div>
          </section>

          {/* Credentials Section */}
          <section className="space-y-3 border-t border-kp-border pt-4">
            <h3 className="text-[0.6875rem] font-semibold uppercase tracking-wider text-kp-text-tertiary">
              🔑 API & Web Servis Kimlik Bilgileri
            </h3>
            {fields.length === 0 ? (
              <p className="text-theme-sm text-kp-text-tertiary">Bu taşıyıcı için ek kimlik bilgisi gerekmiyor.</p>
            ) : (
              fields.map((field) => (
                <label key={field.name} className="block space-y-1">
                  <span className="text-xs font-semibold text-kp-text-secondary">{field.name}</span>
                  <input
                    type={field.secret ? 'password' : 'text'}
                    value={form.credentials[field.name] ?? ''}
                    placeholder={field.secret && isEditMode ? CREDENTIAL_MASK : `${field.name} giriniz`}
                    onChange={(e) => setCredential(field.name, e.target.value)}
                    className={inputClass}
                  />
                  {field.secret && isEditMode && (
                    <span className="text-[0.6875rem] text-kp-text-tertiary">
                      Şifreli alan maskelenmiştir. Değiştirmek istemiyorsanız boş bırakın.
                    </span>
                  )}
                </label>
              ))
            )}
          </section>

          {/* Sender Address Section */}
          <section className="space-y-3 border-t border-kp-border pt-4">
            <h3 className="text-[0.6875rem] font-semibold uppercase tracking-wider text-kp-text-tertiary">
              📍 Varsayılan Gönderici Adresi (İsteğe Bağlı)
            </h3>
            <p className="text-[0.6875rem] text-kp-text-tertiary">
              Kargo etiketinde çıkacak gönderici adres bilgilerini tanımlayın.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {ADDRESS_FIELDS.map((name) => (
                <label key={name} className="block space-y-1">
                  <span className="text-xs text-kp-text-secondary">{t(`address.${name}`) || name}</span>
                  <input
                    type="text"
                    value={form.senderAddress[name] ?? ''}
                    onChange={(e) => setAddress(name, e.target.value)}
                    className={inputClass}
                  />
                </label>
              ))}
            </div>
          </section>

          {/* Carrier Settings Section */}
          <section className="space-y-3 border-t border-kp-border pt-4">
            <h3 className="text-[0.6875rem] font-semibold uppercase tracking-wider text-kp-text-tertiary">
              ⚙️ Kargo Yapılandırması & Etiket Ayarları
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1">
                <span className="text-xs text-kp-text-secondary">Etiket Formatı</span>
                <select
                  value={form.settings.labelFormat}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      settings: { ...prev.settings, labelFormat: e.target.value },
                    }))
                  }
                  className={inputClass}
                >
                  {LABEL_FORMATS.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1">
                <span className="text-xs text-kp-text-secondary">Desi Bölünücüsü (Divisor)</span>
                <input
                  type="number"
                  min={1}
                  value={form.settings.desiDivisor}
                  placeholder="3000"
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      settings: { ...prev.settings, desiDivisor: e.target.value },
                    }))
                  }
                  className={inputClass}
                />
              </label>

              <label className="block space-y-1">
                <span className="text-xs text-kp-text-secondary">Son Alma Saati (Cutoff Time)</span>
                <input
                  type="time"
                  value={form.settings.cutoffTime}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      settings: { ...prev.settings, cutoffTime: e.target.value },
                    }))
                  }
                  className={inputClass}
                />
              </label>

              <label className="block space-y-1">
                <span className="text-xs text-kp-text-secondary">Servis Seviyesi</span>
                <select
                  value={form.settings.defaultServiceLevel}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      settings: { ...prev.settings, defaultServiceLevel: e.target.value },
                    }))
                  }
                  className={inputClass}
                >
                  <option value="">Varsayılan (Standart)</option>
                  {SERVICE_LEVELS.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="flex flex-shrink-0 items-center justify-between border-t border-kp-border bg-slate-900/40 px-6 py-3.5">
          <button type="button" onClick={onClose} className={buttonClass}>
            İptal
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={save}
              disabled={isSaving}
              className="flex items-center gap-2 rounded-kp-md bg-blue-600 px-5 py-2 text-xs font-bold text-white transition-all hover:bg-blue-700 shadow-md shadow-blue-500/10 disabled:opacity-50"
            >
              {isSaving ? (
                <ArrowPathIcon className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircleIcon className="h-4 w-4 stroke-[2.5]" />
              )}
              <span>{isEditMode ? 'Değişiklikleri Kaydet' : 'Bağlantıyı Test Et ve Kaydet'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
