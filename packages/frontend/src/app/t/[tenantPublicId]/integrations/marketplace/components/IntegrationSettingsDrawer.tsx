'use client';

import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import * as HeroIcons from '@heroicons/react/24/outline';
import {
  ArrowPathIcon,
  ArrowTopRightOnSquareIcon,
  Cog6ToothIcon,
  ExclamationTriangleIcon,
  LinkIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import type { IntegrationStatus } from '@kroptos/shared';
import { useIntegrationSettings } from '../hooks/useIntegrationSettings';
import { SettingsSchemaRenderer } from './SettingsSchemaRenderer';
import { SettingsDirtyBar } from './SettingsDirtyBar';
import { SettingsFieldContext } from './fields';

function TabIcon({ name }: { name?: string }) {
  if (!name) return null;
  const Icon = (HeroIcons as Record<string, unknown>)[name] as
    | React.ComponentType<{ className?: string }>
    | undefined;
  if (!Icon) return null;
  return <Icon className="h-4 w-4" />;
}

interface Props {
  integrationId: string;
  integrationName: string;
  status: IntegrationStatus;
  onClose: () => void;
  onTestConnection?: () => void;
  isTesting?: boolean;
  onConfigured?: () => void;
}

export function IntegrationSettingsDrawer({
  integrationId,
  integrationName,
  status,
  onClose,
  onTestConnection,
  isTesting,
  onConfigured,
}: Props) {
  const t = useTranslations();
  const settings = useIntegrationSettings(integrationId);
  const [confirmingClose, setConfirmingClose] = useState(false);

  const {
    manifest,
    values,
    errors,
    isLoading,
    isSaving,
    error,
    isDirty,
    dirtyKeys,
    tabStatus,
    activeTabId,
    setActiveTabId,
    setValue,
    save,
    resetSection,
    discard,
  } = settings;

  const activeSections = useMemo(
    () => manifest?.tabs.find((tab) => tab.id === activeTabId)?.sections ?? [],
    [manifest, activeTabId],
  );

  const requestClose = () => {
    if (isDirty) {
      setConfirmingClose(true);
      return;
    }
    onClose();
  };

  const handleSave = async () => {
    const ok = await save();
    if (ok) onConfigured?.();
  };

  // Rendered into <body>. Inline, this sits inside the page's `space-y-*`
  // wrapper, which puts a `margin-top` on every child — including a
  // `position:fixed` one — and pushed the overlay ~22px down the screen.
  if (typeof document === 'undefined') return null;

  return createPortal(
    <SettingsFieldContext.Provider value={{ integrationId }}>
      {/* Right slide-over drawer shell, identical to CarrierConnectionDrawer */}
      <div
        className="fixed inset-0 z-40 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={requestClose}
      >
        <div
          className="flex h-full w-full max-w-3xl flex-col border-l border-kp-border bg-kp-bg-secondary shadow-kp-elevated animate-slide-in-right overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-kp-border bg-kp-bg-primary/40 px-6 py-4">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-kp-md bg-kp-accent/10 text-kp-accent">
                <Cog6ToothIcon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <h2 className="truncate text-sm font-bold text-kp-text-primary">
                  {integrationName}
                </h2>
                <p className="text-[0.625rem] font-semibold uppercase tracking-wider text-kp-text-tertiary">
                  {manifest?.displayName ?? ''}
                </p>
              </div>
              <span
                className={`ml-1 shrink-0 rounded-full border px-2 py-0.5 text-[0.625rem] font-bold ${
                  status === 'active'
                    ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600'
                    : 'border-kp-danger/20 bg-kp-danger/10 text-kp-danger'
                }`}
              >
                {t(`integrations.settings.status.${status === 'active' ? 'connected' : 'error'}`)}
              </span>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {manifest?.docsUrl && (
                <a
                  href={manifest.docsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 rounded-kp-md border border-kp-border px-3 py-1.5 text-[0.6875rem] font-semibold text-kp-text-secondary transition-colors hover:text-kp-text-primary"
                >
                  <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" />
                  {t('integrations.settings.actions.docs')}
                </a>
              )}
              {onTestConnection && (
                <button
                  type="button"
                  onClick={onTestConnection}
                  disabled={isTesting}
                  className="flex items-center gap-1.5 rounded-kp-md border border-kp-border px-3 py-1.5 text-[0.6875rem] font-semibold text-kp-text-secondary transition-colors hover:text-kp-accent disabled:opacity-50"
                >
                  {isTesting ? (
                    <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <LinkIcon className="h-3.5 w-3.5" />
                  )}
                  {t('integrations.settings.actions.testConnection')}
                </button>
              )}
              <button
                type="button"
                onClick={requestClose}
                className="rounded-kp-md p-1.5 text-kp-text-tertiary transition-colors hover:bg-kp-bg-hover hover:text-kp-text-primary"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
          </header>

          {/* Body */}
          {isLoading ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2">
              <ArrowPathIcon className="h-6 w-6 animate-spin text-kp-accent" />
              <p className="text-xs text-kp-text-tertiary">
                {t('integrations.settings.actions.loading')}
              </p>
            </div>
          ) : !manifest ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 text-center">
              <ExclamationTriangleIcon className="h-8 w-8 text-kp-danger" />
              <p className="text-xs text-kp-text-secondary">
                {error ?? t('integrations.settings.actions.schemaUnavailable')}
              </p>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1">
              {/* Vertical tab rail */}
              <nav className="w-48 shrink-0 overflow-y-auto border-r border-kp-border bg-kp-bg-primary/20 py-3">
                {manifest.tabs.map((tab) => {
                  const isActive = tab.id === activeTabId;
                  const state = tabStatus[tab.id];
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTabId(tab.id)}
                      className={`flex w-full items-center gap-2 border-l-2 px-3 py-2 text-left text-[0.6875rem] font-semibold transition-colors ${
                        isActive
                          ? 'border-kp-accent bg-kp-accent/5 text-kp-accent'
                          : 'border-transparent text-kp-text-tertiary hover:bg-kp-bg-hover hover:text-kp-text-primary'
                      }`}
                    >
                      <TabIcon name={tab.icon} />
                      <span className="min-w-0 flex-1 truncate">{t(tab.titleKey)}</span>
                      {state?.error && (
                        <ExclamationTriangleIcon className="h-3.5 w-3.5 shrink-0 text-kp-warning" />
                      )}
                      {state?.dirty && !state?.error && (
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-kp-accent" />
                      )}
                    </button>
                  );
                })}
              </nav>

              {/* Active tab content */}
              <div className="min-w-0 flex-1 overflow-y-auto p-6">
                <div className="w-full">
                  {error && (
                    <div className="mb-4 flex gap-2 rounded-kp-md border border-kp-danger/20 bg-kp-danger/10 p-3 text-xs text-kp-danger">
                      <ExclamationTriangleIcon className="h-4 w-4 shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}

                  <SettingsSchemaRenderer
                    manifest={manifest}
                    sections={activeSections}
                    values={values}
                    errors={errors}
                    disabled={isSaving}
                    onChange={setValue}
                    onResetSection={resetSection}
                  />
                </div>
              </div>
            </div>
          )}

          {isDirty && (
            <SettingsDirtyBar
              count={dirtyKeys.length}
              isSaving={isSaving}
              onDiscard={discard}
              onSave={handleSave}
            />
          )}
        </div>

        {/* Unsaved-changes guard. z-[70] keeps it above the full-screen shell;
            `z-60` was not a real class in Tailwind 3.4 and only worked by DOM
            order. */}
        {confirmingClose && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
            <div className="w-full max-w-sm overflow-hidden rounded-kp-lg border border-kp-border bg-kp-bg-secondary shadow-kp-elevated animate-scale-in">
              <div className="px-6 py-5">
                <h3 className="flex items-center gap-2 text-sm font-bold text-kp-text-primary">
                  <ExclamationTriangleIcon className="h-5 w-5 text-kp-warning" />
                  {t('integrations.settings.confirmClose.title')}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-kp-text-secondary">
                  {t('integrations.settings.confirmClose.body', { count: dirtyKeys.length })}
                </p>
              </div>
              <div className="flex justify-end gap-2 border-t border-kp-border bg-kp-bg-primary/50 px-6 py-4">
                <button
                  type="button"
                  onClick={() => setConfirmingClose(false)}
                  className="rounded-kp-md border border-kp-border px-4 py-2 text-xs font-semibold text-kp-text-secondary transition-colors hover:text-kp-text-primary"
                >
                  {t('integrations.settings.confirmClose.stay')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmingClose(false);
                    discard();
                    onClose();
                  }}
                  className="rounded-kp-md bg-kp-danger px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-red-600"
                >
                  {t('integrations.settings.confirmClose.leave')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </SettingsFieldContext.Provider>,
    document.body,
  );
}
