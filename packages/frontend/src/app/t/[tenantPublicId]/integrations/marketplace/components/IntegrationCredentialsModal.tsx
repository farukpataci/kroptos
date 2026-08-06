'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowPathIcon, ExclamationTriangleIcon, KeyIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { apiFetch } from '@/lib/api';
import { stripMaskedCredentials } from '@kroptos/shared';
import type { ProviderSettingsManifest, SettingsSection } from '@kroptos/shared';
import { SettingsSchemaRenderer } from './SettingsSchemaRenderer';
import { SettingsFieldContext } from './fields';

interface Integration {
  id: string;
  name: string;
  provider: string;
  credentials?: Record<string, unknown>;
}

/**
 * Credential editing for an existing integration. The fields come from the
 * provider manifest, so this modal has no idea which marketplace it is
 * rendering — the reason the old per-provider form blocks disappeared.
 */
export function IntegrationCredentialsModal({
  integration,
  onClose,
  onSaved,
}: {
  integration: Integration;
  onClose: () => void;
  onSaved: (updated: Integration) => void;
}) {
  const t = useTranslations();
  const [manifest, setManifest] = useState<ProviderSettingsManifest | null>(null);
  const [name, setName] = useState(integration.name);
  const [values, setValues] = useState<Record<string, unknown>>(integration.credentials ?? {});
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiFetch<ProviderSettingsManifest>(`/integrations/${integration.id}/settings/schema`)
      .then((schema) => {
        if (!cancelled) setManifest(schema);
      })
      .catch((err: any) => {
        if (!cancelled) setError(err?.message ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [integration.id]);

  const section: SettingsSection | null = useMemo(() => {
    if (!manifest) return null;
    return {
      id: 'credentials',
      titleKey: 'integrations.settings.sections.credentials.title',
      descriptionKey: 'integrations.settings.sections.credentials.description',
      icon: 'KeyIcon',
      fields: manifest.credentials,
    };
  }, [manifest]);

  const submit = async () => {
    setIsSaving(true);
    setError(null);
    try {
      // Secrets come back masked; sending an untouched mask back would
      // overwrite the real credential with bullets.
      const { credentials } = stripMaskedCredentials(values as Record<string, any>);
      const payload: Record<string, unknown> = { name };
      if (Object.keys(credentials).length > 0) payload.credentials = credentials;

      const updated = await apiFetch<Integration>(`/integrations/${integration.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      onSaved(updated);
      onClose();
    } catch (err: any) {
      setError(err?.message ?? t('integrations.settings.actions.saveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <SettingsFieldContext.Provider value={{ integrationId: integration.id }}>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fade-in">
        <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-kp-lg border border-kp-border bg-kp-bg-secondary shadow-kp-elevated animate-scale-in">
          <header className="flex items-center justify-between border-b border-kp-border bg-kp-bg-primary/30 px-6 py-4">
            <h3 className="flex items-center gap-2.5 text-base font-bold text-kp-text-primary">
              <span className="flex h-7 w-7 items-center justify-center rounded-kp-md bg-kp-accent/10 text-kp-accent">
                <KeyIcon className="h-4 w-4" />
              </span>
              {t('integrations.settings.credentialsModal.title', { name: integration.name })}
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="text-kp-text-tertiary transition-colors hover:text-kp-text-primary"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </header>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-6">
            {error && (
              <div className="flex gap-2 rounded-kp-md border border-kp-danger/20 bg-kp-danger/10 p-3 text-xs text-kp-danger">
                <ExclamationTriangleIcon className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-[0.6875rem] font-semibold uppercase tracking-wider text-kp-text-tertiary">
                {t('integrations.settings.wizard.nameLabel')}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-kp-md border border-kp-border bg-kp-bg-primary px-3.5 py-2 text-xs text-kp-text-primary focus:border-kp-accent focus:outline-hidden"
              />
            </div>

            {manifest && section ? (
              <SettingsSchemaRenderer
                manifest={manifest}
                sections={[section]}
                values={values}
                errors={{}}
                disabled={isSaving}
                onChange={(key, value) => setValues((prev) => ({ ...prev, [key]: value }))}
              />
            ) : (
              <div className="flex justify-center py-8">
                <ArrowPathIcon className="h-5 w-5 animate-spin text-kp-accent" />
              </div>
            )}
          </div>

          <footer className="flex justify-end gap-3 border-t border-kp-border bg-kp-bg-primary/50 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-kp-md border border-kp-border px-4 py-2 text-xs font-semibold text-kp-text-secondary transition-colors hover:text-kp-text-primary"
            >
              {t('integrations.settings.actions.cancel')}
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={isSaving || !manifest}
              className="flex items-center gap-2 rounded-kp-md bg-kp-accent px-5 py-2 text-xs font-semibold text-white shadow-xs transition-all hover:bg-kp-accent-hover disabled:opacity-50"
            >
              {isSaving && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
              {t('integrations.settings.actions.save')}
            </button>
          </footer>
        </div>
      </div>
    </SettingsFieldContext.Provider>
  );
}
