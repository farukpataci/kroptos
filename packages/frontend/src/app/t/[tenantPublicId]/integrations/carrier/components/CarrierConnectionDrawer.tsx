'use client';

import { useEffect, useState } from 'react';
import { ArrowPathIcon, ExclamationTriangleIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useTranslations } from 'next-intl';
import { CREDENTIAL_MASK } from '@kroptos/shared';
import { api } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import { carrierPayload, CarrierFormState } from '../carrierPayload';
import type { CarrierConnection, CarrierProviderOption } from '../types';

interface Props {
  /** The connection being edited, or null for a new one. */
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

  return {
    provider: connection?.provider ?? providers[0]?.provider ?? '',
    displayName: connection?.displayName ?? '',
    // Seeded from what the API returned: public fields carry their real value,
    // secrets carry the mask. Untouched, the mask is stripped before the write.
    credentials: { ...((connection?.credentials ?? {}) as Record<string, string>) },
    isActive: connection?.isActive ?? true,
    isTestMode: connection?.isTestMode ?? true,
    senderAddress: Object.fromEntries(ADDRESS_FIELDS.map((key) => [key, address[key] ?? ''])),
    settings: {
      labelFormat: String(settings.labelFormat ?? 'PDF'),
      desiDivisor: settings.desiDivisor == null ? '' : String(settings.desiDivisor),
      cutoffTime: String(settings.cutoffTime ?? ''),
      defaultServiceLevel: String(settings.defaultServiceLevel ?? ''),
    },
  };
}

export default function CarrierConnectionDrawer({ connection, providers, onClose, onSaved }: Props) {
  const t = useTranslations('carriers');
  const toast = useToast();
  const [form, setForm] = useState<CarrierFormState>(() => initialState(connection, providers));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(initialState(connection, providers));
    setError(null);
  }, [connection, providers]);

  const mode = connection ? 'update' : 'create';
  // The fields this provider needs, straight from the API. Hard-coding them
  // here is how a connector gains a credential and the form keeps asking for
  // yesterday's set.
  const fields = providers.find((p) => p.provider === form.provider)?.requiredFields ?? [];

  const setCredential = (name: string, value: string) =>
    setForm((prev) => ({ ...prev, credentials: { ...prev.credentials, [name]: value } }));

  const setAddress = (name: string, value: string) =>
    setForm((prev) => ({ ...prev, senderAddress: { ...prev.senderAddress, [name]: value } }));

  const save = async () => {
    if (!form.displayName.trim()) {
      setError(t('form.displayNameRequired'));
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      const body = carrierPayload(form, mode);
      if (connection) {
        await api.patch(`/api/carriers/${connection.id}`, body);
      } else {
        await api.post('/api/carriers', body);
      }
      toast.success(t('form.saved'));
      onSaved();
    } catch (e: any) {
      setError(e?.message || t('errors.save'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-2xl flex-col border-l border-kp-border bg-kp-bg-secondary shadow-kp-elevated animate-slide-in-right"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-shrink-0 items-start justify-between border-b border-kp-border bg-kp-bg-primary/40 px-6 py-4">
          <div>
            <h2 className="text-sm font-bold text-kp-text-primary">
              {connection ? t('form.editTitle') : t('form.newTitle')}
            </h2>
            <p className="mt-1 text-xs text-kp-text-tertiary">{t('form.subtitle')}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            title={t('form.close')}
            className="rounded-kp-sm p-1.5 text-kp-text-tertiary transition-colors hover:bg-kp-bg-tertiary hover:text-kp-text-primary"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-4">
          {error && (
            <div className="flex items-center gap-2 rounded-kp-md border border-kp-danger/40 bg-kp-danger-muted px-3.5 py-2 text-theme-sm text-kp-danger">
              <ExclamationTriangleIcon className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <section className="space-y-3">
            <h3 className="text-[0.6875rem] font-semibold uppercase tracking-wider text-kp-text-tertiary">
              {t('form.connection')}
            </h3>

            <label className="block space-y-1">
              <span className="text-xs text-kp-text-secondary">{t('form.provider')}</span>
              <select
                value={form.provider}
                disabled={Boolean(connection)}
                onChange={(e) => setForm((prev) => ({ ...prev, provider: e.target.value }))}
                className={`${inputClass} disabled:opacity-60`}
              >
                {providers.map((option) => (
                  <option key={option.provider} value={option.provider}>
                    {option.provider}
                  </option>
                ))}
              </select>
              {connection && (
                <span className="text-[0.6875rem] text-kp-text-tertiary">
                  {t('form.providerLocked')}
                </span>
              )}
            </label>

            <label className="block space-y-1">
              <span className="text-xs text-kp-text-secondary">{t('form.displayName')}</span>
              <input
                type="text"
                value={form.displayName}
                onChange={(e) => setForm((prev) => ({ ...prev, displayName: e.target.value }))}
                className={inputClass}
              />
            </label>

            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-theme-sm text-kp-text-secondary">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
                />
                {t('form.isActive')}
              </label>
              <label className="flex items-center gap-2 text-theme-sm text-kp-text-secondary">
                <input
                  type="checkbox"
                  checked={form.isTestMode}
                  onChange={(e) => setForm((prev) => ({ ...prev, isTestMode: e.target.checked }))}
                />
                {t('form.isTestMode')}
              </label>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-[0.6875rem] font-semibold uppercase tracking-wider text-kp-text-tertiary">
              {t('form.credentials')}
            </h3>
            {fields.length === 0 ? (
              <p className="text-theme-sm text-kp-text-tertiary">{t('form.noCredentials')}</p>
            ) : (
              fields.map((field) => (
                <label key={field.name} className="block space-y-1">
                  <span className="text-xs text-kp-text-secondary">{field.name}</span>
                  <input
                    // Write-only: a stored secret arrives masked and stays that
                    // way unless retyped, and the mask never goes back up.
                    type={field.secret ? 'password' : 'text'}
                    value={form.credentials[field.name] ?? ''}
                    placeholder={field.secret && connection ? CREDENTIAL_MASK : ''}
                    onChange={(e) => setCredential(field.name, e.target.value)}
                    className={inputClass}
                  />
                  {field.secret && connection && (
                    <span className="text-[0.6875rem] text-kp-text-tertiary">
                      {t('form.secretHint')}
                    </span>
                  )}
                </label>
              ))
            )}
          </section>

          <section className="space-y-3">
            <h3 className="text-[0.6875rem] font-semibold uppercase tracking-wider text-kp-text-tertiary">
              {t('form.senderAddress')}
            </h3>
            <p className="text-[0.6875rem] text-kp-text-tertiary">{t('form.senderAddressHint')}</p>
            <div className="grid grid-cols-2 gap-3">
              {ADDRESS_FIELDS.map((name) => (
                <label key={name} className="block space-y-1">
                  <span className="text-xs text-kp-text-secondary">{t(`address.${name}`)}</span>
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

          <section className="space-y-3">
            <h3 className="text-[0.6875rem] font-semibold uppercase tracking-wider text-kp-text-tertiary">
              {t('form.settings')}
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <label className="block space-y-1">
                <span className="text-xs text-kp-text-secondary">{t('settings.labelFormat')}</span>
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
                <span className="text-xs text-kp-text-secondary">{t('settings.desiDivisor')}</span>
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
                <span className="text-[0.6875rem] text-kp-text-tertiary">
                  {t('settings.desiDivisorHint')}
                </span>
              </label>

              <label className="block space-y-1">
                <span className="text-xs text-kp-text-secondary">{t('settings.cutoffTime')}</span>
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
                <span className="text-xs text-kp-text-secondary">
                  {t('settings.defaultServiceLevel')}
                </span>
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
                  <option value="">{t('settings.none')}</option>
                  {SERVICE_LEVELS.map((value) => (
                    <option key={value} value={value}>
                      {t(`serviceLevel.${value}`)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>
        </div>

        <div className="flex flex-shrink-0 items-center justify-end gap-2 border-t border-kp-border px-6 py-3">
          <button type="button" onClick={onClose} className={buttonClass}>
            {t('form.cancel')}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={isSaving}
            className="flex items-center gap-2 rounded-kp-md bg-kp-accent px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-kp-accent-hover disabled:opacity-50"
          >
            {isSaving && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
            {t('form.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
