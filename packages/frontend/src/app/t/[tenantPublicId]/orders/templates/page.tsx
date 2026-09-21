'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { EnvelopeIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { useToast } from '@/components/ui/Toast';
import { usePermission } from '@/hooks/usePermission';
import { useAuth } from '@/lib/auth-context';
import { SubPageShell } from '@/components/layout/SubPageShell';
import { useNotificationTemplates, type TemplateRow } from './hooks/useNotificationTemplates';
import TemplatesTable, { LevelBadge } from './components/TemplatesTable';
import TemplateEditorDrawer from './components/TemplateEditorDrawer';
import LogsTable from './components/LogsTable';
import ProvidersForm from './components/ProvidersForm';

type Tab = 'templates' | 'logs' | 'providers';

/**
 * Siparişler → E-posta / SMS Şablonları. Üç sekme: Şablonlar · Gönderim Günlüğü ·
 * Sağlayıcı Ayarları (yalnız notification_provider.manage). Kapsam üst bardan:
 * "Tüm Markalar" = firma seviyesi, marka seçili = marka, mağaza seçili = mağaza.
 */
export default function TemplatesPage() {
  const t = useTranslations('notificationTemplates');
  const tp = useTranslations('orderSubPages');
  const tc = useTranslations('common');
  const toast = useToast();
  const { can } = usePermission();
  const { tenantContext } = useAuth();
  const params = useParams<{ tenantPublicId: string }>();
  const api = useNotificationTemplates();

  const [tab, setTab] = useState<Tab>('templates');
  const [openId, setOpenId] = useState<string | null>(null);

  const canEdit = can('notification_template.update');
  const canCreate = can('notification_template.create');
  const canTestSend = can('notification_template.test_send');
  const canLogs = can('notification_log.read');
  const canProviders = can('notification_provider.manage');

  const tabs: { id: Tab; label: string; show: boolean }[] = [
    { id: 'templates', label: t('tabs.templates'), show: true },
    { id: 'logs', label: t('tabs.logs'), show: canLogs },
    { id: 'providers', label: t('tabs.providers'), show: canProviders },
  ];

  const onToggle = async (row: TemplateRow) => {
    try {
      await api.toggle(row.id);
      toast.success(row.isActive ? t('table.deactivated') : t('table.activated'));
      api.refresh();
    } catch (e: any) {
      toast.error(e?.message || tc('unknownError'));
    }
  };

  if (!tenantContext.agencyId) {
    return (
      <SubPageShell title={tp('templates.title')} subtitle={tp('templates.subtitle')} icon={EnvelopeIcon}>
        <div className="card p-8 text-center text-sm text-kp-text-tertiary">{t('noContext')}</div>
      </SubPageShell>
    );
  }

  return (
    <SubPageShell
      title={tp('templates.title')}
      subtitle={tp('templates.subtitle')}
      icon={EnvelopeIcon}
      error={tab === 'templates' ? api.error : null}
      onReload={tab === 'templates' ? api.refresh : undefined}
      isLoading={api.isLoading}
      reloadLabel={tc('actions.refresh')}
      actions={<span className="flex items-center gap-2 text-[0.6875rem] text-kp-text-tertiary">{t('editingLevel')} <LevelBadge level={api.level} /></span>}
    >
      <div className="border-b border-kp-border">
        <nav className="-mb-px flex gap-1 overflow-x-auto">
          {tabs.filter((x) => x.show).map((x) => (
            <button key={x.id} type="button" onClick={() => setTab(x.id)} className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors ${tab === x.id ? 'border-kp-accent text-kp-accent' : 'border-transparent text-kp-text-secondary hover:border-kp-border hover:text-kp-text-primary'}`}>
              {x.label}
            </button>
          ))}
        </nav>
      </div>

      {tab === 'templates' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-kp-md border border-kp-border p-0.5">
              {([['', t('filters.allChannels')], ['EMAIL', t('channel.EMAIL')], ['SMS', t('channel.SMS')]] as const).map(([v, label]) => (
                <button key={v} type="button" onClick={() => api.setFilters((f) => ({ ...f, channel: v }))} className={`rounded-kp-md px-3 py-1 text-xs font-semibold ${api.filters.channel === v ? 'bg-kp-accent text-white' : 'text-kp-text-secondary hover:text-kp-text-primary'}`}>{label}</button>
              ))}
            </div>
            <select value={api.filters.locale} onChange={(e) => api.setFilters((f) => ({ ...f, locale: e.target.value }))} className="rounded-kp-md border border-kp-border bg-kp-bg-primary px-2 py-1.5 text-xs text-kp-text-primary">
              {api.locales.map((l) => <option key={l} value={l}>{t(`locales.${l}`)}</option>)}
            </select>
            <div className="relative">
              <MagnifyingGlassIcon className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-kp-text-tertiary" />
              <input value={api.filters.search} onChange={(e) => api.setFilters((f) => ({ ...f, search: e.target.value }))} placeholder={t('filters.search')} className="w-64 rounded-kp-md border border-kp-border bg-kp-bg-primary py-1.5 pl-8 pr-3 text-xs text-kp-text-primary" />
            </div>
          </div>
          <p className="text-[0.6875rem] text-kp-text-tertiary">{t('scopeHint')}</p>
          <TemplatesTable items={api.items} isLoading={api.isLoading} canEdit={canEdit} canCreate={canCreate} onOpen={(row) => setOpenId(row.id)} onToggle={onToggle} />
        </div>
      )}

      {tab === 'logs' && canLogs && <LogsTable tenantPublicId={params.tenantPublicId} />}
      {tab === 'providers' && canProviders && <ProvidersForm />}

      {openId && (
        <TemplateEditorDrawer templateId={openId} api={api} canEdit={canEdit} canCreate={canCreate} canTestSend={canTestSend} onClose={() => setOpenId(null)} onChanged={api.refresh} />
      )}
    </SubPageShell>
  );
}
