'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ArrowPathIcon,
  BoltIcon,
  Cog6ToothIcon,
  ExclamationTriangleIcon,
  PlusIcon,
  TruckIcon,
} from '@heroicons/react/24/outline';
import { useTranslations } from 'next-intl';
import StatusBadge from '@/components/ui/StatusBadge';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import CarrierConnectionDrawer from './components/CarrierConnectionDrawer';
import type { CarrierConnection, CarrierProviderOption, ConnectionTestResult } from './types';

const buttonClass =
  'flex items-center gap-2 rounded-kp-md border border-kp-border px-3 py-2 text-xs font-semibold text-kp-text-secondary transition-all hover:bg-kp-bg-hover disabled:opacity-40';

export default function CarrierIntegrationsPage() {
  const t = useTranslations('carriers');
  const toast = useToast();
  const [connections, setConnections] = useState<CarrierConnection[]>([]);
  const [providers, setProviders] = useState<CarrierProviderOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<CarrierConnection | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [rows, options] = await Promise.all([
        api.get<CarrierConnection[]>('/api/carriers'),
        api.get<CarrierProviderOption[]>('/api/carriers/providers'),
      ]);
      setConnections(rows);
      setProviders(options);
    } catch (e: any) {
      // A 403 here means the role lacks carriers.read; an empty grid would read
      // as "no carriers configured" instead of "not yours to see".
      setError(e?.message || t('errors.load'));
      setConnections([]);
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const test = async (row: CarrierConnection) => {
    setTestingId(row.id);
    try {
      const result = await api.post<ConnectionTestResult>(`/api/carriers/${row.id}/test`);
      if (result.success) toast.success(result.message || t('test.ok'));
      else toast.error(result.message || t('test.failed'));
      // The row carries lastTestedAt/lastTestOk, so the card has to be re-read
      // rather than guessed at from the toast.
      await load();
    } catch (e: any) {
      toast.error(e?.message || t('errors.test'));
    } finally {
      setTestingId(null);
    }
  };

  const toggleActive = async (row: CarrierConnection) => {
    setTogglingId(row.id);
    try {
      await api.patch(`/api/carriers/${row.id}`, { isActive: !row.isActive });
      toast.success(row.isActive ? t('toggle.deactivated') : t('toggle.activated'));
      await load();
    } catch (e: any) {
      toast.error(e?.message || t('errors.toggle'));
    } finally {
      setTogglingId(null);
    }
  };

  const openNew = () => {
    setEditing(null);
    setIsDrawerOpen(true);
  };

  const openEdit = (row: CarrierConnection) => {
    setEditing(row);
    setIsDrawerOpen(true);
  };

  const when = (value: string | null) => (value ? new Date(value).toLocaleString() : t('test.never'));

  return (
    <div className="space-y-6 animate-fade-in p-6">
      <div className="flex items-center justify-between border-b border-kp-border pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-kp-md bg-kp-accent/10 text-kp-accent">
            <TruckIcon className="h-5 w-5" />
          </div>
          <div>
            <h1 className="page-title">{t('title')}</h1>
            <p className="page-subtitle">{t('subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={load} disabled={isLoading} className={buttonClass}>
            <ArrowPathIcon className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            {t('reload')}
          </button>
          <button
            type="button"
            onClick={openNew}
            disabled={providers.length === 0}
            title={providers.length === 0 ? t('noProviders') : undefined}
            className="flex items-center gap-2 rounded-kp-md bg-kp-accent px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-kp-accent-hover disabled:opacity-50"
          >
            <PlusIcon className="h-4 w-4" />
            {t('new')}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-kp-md border border-kp-danger/40 bg-kp-danger-muted px-3.5 py-2 text-theme-sm text-kp-danger">
          <ExclamationTriangleIcon className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {isLoading ? (
        <div className="py-16 text-center">
          <ArrowPathIcon className="mx-auto h-6 w-6 animate-spin text-kp-accent" />
        </div>
      ) : connections.length === 0 ? (
        <div className="card px-6 py-16 text-center text-theme-sm text-kp-text-tertiary">
          {t('empty')}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {connections.map((row) => (
            <div key={row.id} className="card space-y-3 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-theme-sm font-semibold text-kp-text-primary">
                    {row.displayName}
                  </p>
                  <p className="font-mono text-xs uppercase text-kp-text-tertiary">{row.provider}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <StatusBadge
                    status={row.isActive ? 'active' : 'inactive'}
                    label={row.isActive ? t('active') : t('inactive')}
                  />
                  {row.isTestMode && (
                    <span className="badge badge--warning">{t('testMode')}</span>
                  )}
                </div>
              </div>

              <div className="space-y-0.5 text-xs text-kp-text-tertiary">
                <p>
                  {t('test.last')}: {when(row.lastTestedAt)}
                </p>
                <p
                  className={
                    row.lastTestOk === null
                      ? undefined
                      : row.lastTestOk
                        ? 'text-kp-success'
                        : 'text-kp-danger'
                  }
                >
                  {row.lastTestOk === null
                    ? t('test.neverRun')
                    : row.lastTestOk
                      ? t('test.ok')
                      : t('test.failed')}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-kp-border pt-3">
                <button
                  type="button"
                  onClick={() => test(row)}
                  disabled={testingId === row.id}
                  className={buttonClass}
                >
                  <BoltIcon className={`h-4 w-4 ${testingId === row.id ? 'animate-pulse' : ''}`} />
                  {t('test.run')}
                </button>
                <button type="button" onClick={() => openEdit(row)} className={buttonClass}>
                  <Cog6ToothIcon className="h-4 w-4" />
                  {t('edit')}
                </button>
                <button
                  type="button"
                  onClick={() => toggleActive(row)}
                  disabled={togglingId === row.id}
                  className={buttonClass}
                >
                  {row.isActive ? t('toggle.deactivate') : t('toggle.activate')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {isDrawerOpen && (
        <CarrierConnectionDrawer
          connection={editing}
          providers={providers}
          onClose={() => setIsDrawerOpen(false)}
          onSaved={() => {
            setIsDrawerOpen(false);
            load();
          }}
        />
      )}
    </div>
  );
}
