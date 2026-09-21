'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowPathIcon, CheckCircleIcon, SignalIcon } from '@heroicons/react/24/outline';
import { useToast } from '@/components/ui/Toast';
import { useNotificationProviders, type ProviderConfig } from '../hooks/useNotificationProviders';
import type { Channel } from '../hooks/useNotificationTemplates';

const inputCls = 'w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3 py-1.5 text-xs text-kp-text-primary';
const labelCls = 'block text-[0.6875rem] font-bold text-kp-text-primary uppercase tracking-wider';

/** Kanal başına sağlayıcı; secret alanlar yazıldıktan sonra maskeli, boş bırakılan secret korunur. */
export default function ProvidersForm() {
  const t = useTranslations('notificationTemplates');
  const tc = useTranslations('common');
  const providers = useNotificationProviders(true);

  if (providers.error) return <div className="rounded-kp-md border border-kp-danger/40 bg-kp-danger-muted px-3.5 py-2 text-xs text-kp-danger">{providers.error}</div>;
  if (providers.isLoading && providers.items.length === 0) return <div className="text-xs text-kp-text-tertiary">…</div>;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {providers.items.map((cfg) => (
        <ChannelCard key={cfg.channel} cfg={cfg} save={providers.save} test={providers.test} onSaved={providers.refresh} t={t} tc={tc} />
      ))}
    </div>
  );
}

function ChannelCard({ cfg, save, test, onSaved, t, tc }: { cfg: ProviderConfig; save: ReturnType<typeof useNotificationProviders>['save']; test: ReturnType<typeof useNotificationProviders>['test']; onSaved: () => void; t: any; tc: any }) {
  const toast = useToast();
  const [provider, setProvider] = useState(cfg.provider ?? cfg.options[0]);
  const [isActive, setIsActive] = useState(cfg.isActive);
  const [config, setConfig] = useState<Record<string, unknown>>(cfg.config);
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<'save' | 'test' | null>(null);

  useEffect(() => {
    setProvider(cfg.provider ?? cfg.options[0]);
    setIsActive(cfg.isActive);
    setConfig(cfg.config);
    setSecrets({});
  }, [cfg]);

  const fields = cfg.fields[provider] ?? [];

  const onSave = async () => {
    setBusy('save');
    try {
      await save({ channel: cfg.channel as Channel, provider, isActive, config, secrets });
      toast.success(t('providers.saved'));
      onSaved();
    } catch (e: any) {
      toast.error(e?.message || tc('unknownError'));
    } finally {
      setBusy(null);
    }
  };
  const onTest = async () => {
    setBusy('test');
    try {
      const r = await test(cfg.channel as Channel);
      toast.success(t('providers.testOk', { provider: r.provider }));
    } catch (e: any) {
      toast.error(e?.message || tc('unknownError'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="card space-y-4 p-5">
      <div className="flex items-center justify-between border-b border-kp-border pb-3">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-kp-text-primary">{t(`channel.${cfg.channel}`)}</h3>
          <p className="text-[0.6875rem] text-kp-text-tertiary">{cfg.provider ? t('providers.configured', { provider: cfg.provider }) : t('providers.notConfigured')}</p>
        </div>
        <label className="flex items-center gap-2 text-xs text-kp-text-secondary">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4 rounded border-kp-border text-kp-accent" />
          {t('providers.active')}
        </label>
      </div>
      <div className="space-y-1.5">
        <label className={labelCls}>{t('providers.provider')}</label>
        <select value={provider} onChange={(e) => { setProvider(e.target.value); setSecrets({}); }} className={inputCls}>
          {cfg.options.map((o) => <option key={o} value={o}>{t(`providers.names.${o}`)}</option>)}
        </select>
        {provider === 'console' && <p className="text-[0.6875rem] text-kp-warning">{t('providers.consoleNote')}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {fields.map((f) => (
          <div key={f.key} className={`space-y-1.5 ${f.key === 'host' || f.key === 'fromEmail' ? 'col-span-2' : ''}`}>
            <label className={labelCls}>{f.label}</label>
            {f.type === 'boolean' ? (
              <input type="checkbox" checked={config[f.key] === true} onChange={(e) => setConfig((c) => ({ ...c, [f.key]: e.target.checked }))} className="h-4 w-4 rounded border-kp-border text-kp-accent" />
            ) : f.secret ? (
              <input type="password" autoComplete="new-password" value={secrets[f.key] ?? ''} onChange={(e) => setSecrets((s) => ({ ...s, [f.key]: e.target.value }))} placeholder={cfg.secretsSet.includes(f.key) && cfg.provider === provider ? '••••••••' : ''} className={inputCls} />
            ) : (
              <input type={f.type === 'number' ? 'number' : 'text'} value={(config[f.key] as string) ?? ''} onChange={(e) => setConfig((c) => ({ ...c, [f.key]: f.type === 'number' ? Number(e.target.value) : e.target.value }))} className={inputCls} />
            )}
            {f.secret && cfg.secretsSet.includes(f.key) && cfg.provider === provider && <p className="text-[0.625rem] text-kp-text-tertiary">{t('providers.secretKept')}</p>}
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-3 border-t border-kp-border pt-3">
        <button type="button" onClick={onTest} disabled={busy !== null || !cfg.provider} className="flex items-center gap-1.5 rounded-kp-md border border-kp-border px-3.5 py-1.5 text-xs font-semibold text-kp-text-secondary disabled:opacity-50">
          {busy === 'test' ? <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" /> : <SignalIcon className="h-3.5 w-3.5" />} {t('providers.test')}
        </button>
        <button type="button" onClick={onSave} disabled={busy !== null} className="flex items-center gap-1.5 rounded-kp-md bg-kp-accent px-4 py-1.5 text-xs font-semibold text-white hover:bg-kp-accent-hover disabled:opacity-50">
          {busy === 'save' ? <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" /> : <CheckCircleIcon className="h-3.5 w-3.5" />} {tc('actions.save')}
        </button>
      </div>
    </div>
  );
}
