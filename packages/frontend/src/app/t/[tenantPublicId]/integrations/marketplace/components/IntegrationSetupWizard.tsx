'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  CheckCircleIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import type { ProviderSettingsManifest, SettingsSection } from '@kroptos/shared';
import { useIntegrationSettings } from '../hooks/useIntegrationSettings';
import { SettingsSchemaRenderer } from './SettingsSchemaRenderer';
import { SettingsFieldContext } from './fields';

interface Integration {
  id: string;
  name: string;
  provider: string;
  status: string;
}

/**
 * Steps 1–3 create the integration from its credentials; step 4 walks the
 * manifest's wizard steps. Once an integration exists the wizard can be
 * re-entered at the first incomplete step, so abandoning it halfway loses
 * nothing.
 */
type Phase = 'credentials' | 'testing' | 'configure' | 'done';

interface Props {
  provider: string;
  presetName: string;
  /** Set when resuming an integration that already exists. */
  existing?: Integration | null;
  onClose: () => void;
  onCreated: (integration: Integration) => void;
  onFinished: () => void;
}

export function IntegrationSetupWizard({
  provider,
  presetName,
  existing,
  onClose,
  onCreated,
  onFinished,
}: Props) {
  const t = useTranslations();
  const { tenantContext } = useAuth();

  const [phase, setPhase] = useState<Phase>(existing ? 'configure' : 'credentials');
  const [integration, setIntegration] = useState<Integration | null>(existing ?? null);
  const [providerManifest, setProviderManifest] = useState<ProviderSettingsManifest | null>(null);
  const [name, setName] = useState(existing?.name ?? presetName);
  const [credentials, setCredentials] = useState<Record<string, unknown>>({});
  const [credentialErrors, setCredentialErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const settings = useIntegrationSettings(integration?.id ?? null);
  const manifest = settings.manifest ?? providerManifest;

  // Credentials are described by the manifest too, so the same renderer draws
  // them — one synthetic section is all it takes.
  const credentialSection: SettingsSection | null = useMemo(() => {
    if (!manifest) return null;
    return {
      id: 'credentials',
      titleKey: 'integrations.settings.sections.credentials.title',
      descriptionKey: 'integrations.settings.sections.credentials.description',
      icon: 'KeyIcon',
      fields: manifest.credentials,
    };
  }, [manifest]);

  const wizardSteps = manifest?.wizard ?? [];
  const currentStep = wizardSteps[stepIndex];

  const stepSections: SettingsSection[] = useMemo(() => {
    if (!manifest || !currentStep) return [];
    return manifest.tabs
      .filter((tab) => !currentStep.tabId || tab.id === currentStep.tabId)
      .flatMap((tab) => tab.sections)
      .filter((section) => !currentStep.sectionIds || currentStep.sectionIds.includes(section.id));
  }, [manifest, currentStep]);

  // ------------------------------------------------------------------ actions

  // The credentials form is needed before an integration exists, so it comes
  // from the provider-level schema endpoint rather than the per-integration one.
  useEffect(() => {
    if (existing) return;
    let cancelled = false;

    apiFetch<ProviderSettingsManifest>(`/integrations/settings/providers/${provider}/schema`)
      .then((schema) => {
        if (!cancelled) setProviderManifest(schema);
      })
      .catch((err: any) => {
        if (!cancelled) setFormError(err?.message ?? t('integrations.settings.wizard.schemaFailed'));
      });

    return () => {
      cancelled = true;
    };
  }, [provider, existing, t]);

  const createAndTest = async () => {
    if (!manifest) return;

    const missing = manifest.credentials
      .filter((field) => field.required && !credentials[field.key])
      .map((field) => field.key);
    if (missing.length > 0) {
      setCredentialErrors(
        Object.fromEntries(missing.map((key) => [key, 'integrations.settings.validation.required'])),
      );
      return;
    }

    setIsBusy(true);
    setFormError(null);
    setPhase('testing');
    try {
      const created = await apiFetch<Integration>('/integrations', {
        method: 'POST',
        body: JSON.stringify({
          name,
          provider,
          providerType: 'marketplace',
          agencyId: tenantContext.agencyId,
          clientId: tenantContext.clientId || undefined,
          storeId: tenantContext.storeId || undefined,
          credentials,
        }),
      });

      const test = await apiFetch<{ success: boolean; message: string }>(
        `/integrations/${created.id}/test-connection`,
        { method: 'POST' },
      );

      setIntegration(created);
      onCreated(created);

      if (!test.success) {
        // The integration is kept: the user fixes the credentials in place
        // rather than starting over and leaving an orphan behind.
        setFormError(test.message);
        setPhase('credentials');
        return;
      }

      setPhase('configure');
      setStepIndex(0);
    } catch (err: any) {
      setFormError(err?.message ?? t('integrations.settings.wizard.createFailed'));
      setPhase('credentials');
    } finally {
      setIsBusy(false);
    }
  };

  const goNext = async () => {
    if (!currentStep) return;
    const ok = await settings.completeStep(currentStep.id);
    if (!ok) return;

    if (stepIndex + 1 < wizardSteps.length) setStepIndex(stepIndex + 1);
    else setPhase('done');
  };

  const skipStep = () => {
    if (stepIndex + 1 < wizardSteps.length) setStepIndex(stepIndex + 1);
    else setPhase('done');
  };

  const startFirstSync = async () => {
    if (!integration) return;
    setIsBusy(true);
    try {
      await apiFetch(`/integrations/${integration.id}/sync`, { method: 'POST' });
      onFinished();
    } catch (err: any) {
      setFormError(err?.message ?? t('integrations.settings.wizard.syncFailed'));
    } finally {
      setIsBusy(false);
    }
  };

  // ------------------------------------------------------------------- render

  const totalSteps = 3 + wizardSteps.length;
  const currentNumber =
    phase === 'credentials' ? 2 : phase === 'testing' ? 3 : phase === 'done' ? totalSteps : 4 + stepIndex;

  return (
    <SettingsFieldContext.Provider value={{ integrationId: integration?.id ?? null }}>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-fade-in">
        <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-kp-lg border border-kp-border bg-kp-bg-secondary shadow-kp-elevated animate-scale-in">
          {/* Header + progress */}
          <header className="border-b border-kp-border bg-kp-bg-primary/30 px-6 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-base font-bold text-kp-text-primary">
                  {t('integrations.settings.wizard.title', { name: presetName })}
                </h2>
                <p className="mt-0.5 text-[0.6875rem] text-kp-text-tertiary">
                  {t('integrations.settings.wizard.progress', {
                    current: currentNumber,
                    total: totalSteps,
                  })}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {manifest?.docsUrl && phase === 'credentials' && (
                  <a
                    href={manifest.docsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 rounded-kp-md border border-kp-border px-3 py-1.5 text-[0.6875rem] font-semibold text-kp-text-secondary transition-colors hover:text-kp-text-primary"
                  >
                    <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                    {t('integrations.settings.wizard.howToGet')}
                  </a>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="text-kp-text-tertiary transition-colors hover:text-kp-text-primary"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="mt-3 h-1 overflow-hidden rounded-full bg-kp-bg-tertiary">
              <div
                className="h-full rounded-full bg-kp-accent transition-all"
                style={{ width: `${(currentNumber / totalSteps) * 100}%` }}
              />
            </div>
          </header>

          {/* Body */}
          <div className="min-h-0 flex-1 overflow-y-auto p-6">
            {formError && (
              <div className="mb-4 flex gap-2 rounded-kp-md border border-kp-danger/20 bg-kp-danger/10 p-3 text-xs text-kp-danger">
                <ExclamationTriangleIcon className="h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {phase === 'testing' && (
              <div className="flex flex-col items-center justify-center gap-3 py-14">
                <ArrowPathIcon className="h-7 w-7 animate-spin text-kp-accent" />
                <p className="text-xs text-kp-text-secondary">
                  {t('integrations.settings.wizard.testing')}
                </p>
              </div>
            )}

            {phase === 'credentials' && credentialSection && manifest && (
              <div className="space-y-5">
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

                <SettingsSchemaRenderer
                  manifest={manifest}
                  sections={[credentialSection]}
                  values={credentials}
                  errors={Object.fromEntries(
                    Object.entries(credentialErrors).map(([key, messageKey]) => [key, t(messageKey)]),
                  )}
                  disabled={isBusy}
                  onChange={(key, value) => {
                    setCredentials((prev) => ({ ...prev, [key]: value }));
                    setCredentialErrors((prev) => {
                      const next = { ...prev };
                      delete next[key];
                      return next;
                    });
                  }}
                />
              </div>
            )}

            {phase === 'configure' && manifest && currentStep && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-kp-text-primary">
                    {t(currentStep.titleKey)}
                  </h3>
                  {currentStep.descriptionKey && (
                    <p className="mt-1 text-[0.6875rem] leading-relaxed text-kp-text-tertiary">
                      {t(currentStep.descriptionKey)}
                    </p>
                  )}
                </div>

                <SettingsSchemaRenderer
                  manifest={manifest}
                  sections={stepSections}
                  values={settings.values}
                  errors={settings.errors}
                  disabled={settings.isSaving}
                  onChange={settings.setValue}
                />
              </div>
            )}

            {phase === 'done' && (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <CheckCircleIcon className="h-12 w-12 text-emerald-500" />
                <h3 className="text-sm font-bold text-kp-text-primary">
                  {t('integrations.settings.wizard.doneTitle')}
                </h3>
                <p className="max-w-md text-xs leading-relaxed text-kp-text-tertiary">
                  {settings.isConfigured
                    ? t('integrations.settings.wizard.doneBody')
                    : t('integrations.settings.wizard.doneIncomplete', {
                        count: settings.missingRequired.length,
                      })}
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <footer className="flex items-center justify-between gap-3 border-t border-kp-border bg-kp-bg-primary/50 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-kp-md border border-kp-border px-4 py-2 text-xs font-semibold text-kp-text-secondary transition-colors hover:text-kp-text-primary"
            >
              {t('integrations.settings.wizard.close')}
            </button>

            <div className="flex items-center gap-2">
              {phase === 'configure' && currentStep && !currentStep.required && (
                <button
                  type="button"
                  onClick={skipStep}
                  className="rounded-kp-md border border-kp-border px-4 py-2 text-xs font-semibold text-kp-text-secondary transition-colors hover:text-kp-text-primary"
                >
                  {t('integrations.settings.wizard.skip')}
                </button>
              )}

              {phase === 'credentials' && (
                <button
                  type="button"
                  onClick={createAndTest}
                  disabled={isBusy || !manifest}
                  className="flex items-center gap-2 rounded-kp-md bg-kp-accent px-5 py-2 text-xs font-semibold text-white shadow-xs transition-all hover:bg-kp-accent-hover disabled:opacity-50"
                >
                  {isBusy && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
                  {t('integrations.settings.wizard.connectAndTest')}
                </button>
              )}

              {phase === 'configure' && (
                <button
                  type="button"
                  onClick={goNext}
                  disabled={settings.isSaving}
                  className="flex items-center gap-2 rounded-kp-md bg-kp-accent px-5 py-2 text-xs font-semibold text-white shadow-xs transition-all hover:bg-kp-accent-hover disabled:opacity-50"
                >
                  {settings.isSaving && <ArrowPathIcon className="h-4 w-4 animate-spin" />}
                  {t('integrations.settings.wizard.next')}
                </button>
              )}

              {phase === 'done' && (
                <button
                  type="button"
                  onClick={startFirstSync}
                  disabled={isBusy || !settings.isConfigured}
                  title={
                    settings.isConfigured
                      ? undefined
                      : t('integrations.settings.actions.syncBlocked')
                  }
                  className="flex items-center gap-2 rounded-kp-md bg-kp-accent px-5 py-2 text-xs font-semibold text-white shadow-xs transition-all hover:bg-kp-accent-hover disabled:opacity-50"
                >
                  {isBusy ? (
                    <ArrowPathIcon className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckIcon className="h-4 w-4" />
                  )}
                  {t('integrations.settings.wizard.startSync')}
                </button>
              )}
            </div>
          </footer>
        </div>
      </div>
    </SettingsFieldContext.Provider>
  );
}
