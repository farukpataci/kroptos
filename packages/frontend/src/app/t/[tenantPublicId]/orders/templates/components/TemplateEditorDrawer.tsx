'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  ArrowPathIcon, ArrowUturnLeftIcon, ClockIcon, ComputerDesktopIcon, DevicePhoneMobileIcon,
  ExclamationTriangleIcon, InformationCircleIcon, PaperAirplaneIcon, XMarkIcon,
} from '@heroicons/react/24/outline';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';
import type { PreviewResult, TemplateDetail, TemplateIssue, TemplateVersion, VariableDef } from '../hooks/useNotificationTemplates';
import { useNotificationTemplates } from '../hooks/useNotificationTemplates';
import { LevelBadge } from './TemplatesTable';

type Api = ReturnType<typeof useNotificationTemplates>;

interface Props {
  templateId: string;
  api: Api;
  canEdit: boolean;
  canCreate: boolean;
  canTestSend: boolean;
  onClose: () => void;
  onChanged: () => void;
}

type Form = Pick<TemplateDetail, 'name' | 'subject' | 'bodyHtml' | 'bodyText' | 'senderName' | 'replyTo' | 'smsSenderId' | 'sendDelayMinutes'>;
const FIELDS: (keyof Form)[] = ['name', 'subject', 'bodyHtml', 'bodyText', 'senderName', 'replyTo', 'smsSenderId', 'sendDelayMinutes'];

const inputCls = 'w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3 py-1.5 text-xs text-kp-text-primary disabled:opacity-60';
const labelCls = 'block text-[0.6875rem] font-bold text-kp-text-primary uppercase tracking-wider';

/** Sağdan açılan geniş düzenleyici: sol form + değişkenler, sağ canlı önizleme. */
export default function TemplateEditorDrawer({ templateId, api, canEdit, canCreate, canTestSend, onClose, onChanged }: Props) {
  const t = useTranslations('notificationTemplates');
  const te = useTranslations('notificationTemplates.events');
  const tc = useTranslations('common');
  const toast = useToast();

  const [tpl, setTpl] = useState<TemplateDetail | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [vars, setVars] = useState<VariableDef[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewWidth, setPreviewWidth] = useState<'desktop' | 'mobile'>('desktop');
  const [orderId, setOrderId] = useState('');
  const [orders, setOrders] = useState<{ id: string; orderNumber: string; customerName: string }[]>([]);
  const [testOpen, setTestOpen] = useState(false);
  const [testRecipient, setTestRecipient] = useState('');
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [versions, setVersions] = useState<TemplateVersion[] | null>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  const lastFocus = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);
  // Hook her render'da yeni nesne döner; effect bağımlılığı olursa döngüye girer → ref.
  const apiRef = useRef(api);
  apiRef.current = api;

  const load = useCallback(async (id: string) => {
    setLoadError(null);
    try {
      const d = await apiRef.current.get(id);
      const v = await apiRef.current.variables(d.event);
      setTpl(d);
      setForm(Object.fromEntries(FIELDS.map((f) => [f, d[f] ?? (f === 'sendDelayMinutes' ? 0 : '')])) as Form);
      setVars(v);
    } catch (e: any) {
      setLoadError(e?.message || tc('unknownError'));
    }
  }, [tc]);

  useEffect(() => {
    load(templateId);
  }, [load, templateId]);

  // Gerçek sipariş seçimi için hafif liste (numara + müşteri); arama istemci tarafında.
  useEffect(() => {
    apiFetch<any[]>('/api/orders').then((rows) => setOrders((rows || []).slice(0, 200).map((o) => ({ id: o.id, orderNumber: o.orderNumber, customerName: o.customerName })))).catch(() => setOrders([]));
  }, []);

  const editable = !!tpl && tpl.editable && canEdit;
  const dirty = useMemo(() => !!tpl && !!form && FIELDS.some((f) => (form[f] ?? '') !== (tpl[f] ?? (f === 'sendDelayMinutes' ? 0 : ''))), [tpl, form]);

  // Canlı önizleme: 500 ms debounce, eski istek iptal.
  useEffect(() => {
    if (!tpl || !form) return;
    const controller = new AbortController();
    const h = setTimeout(() => {
      apiRef.current.preview({ channel: tpl.channel, event: tpl.event, subject: form.subject ?? undefined, bodyHtml: form.bodyHtml ?? undefined, bodyText: form.bodyText ?? undefined, orderId: orderId || undefined }, controller.signal)
        .then(setPreview)
        .catch((e) => { if (e?.name !== 'AbortError') setPreview({ issues: [{ field: 'preview', line: 0, message: e?.message || 'preview failed' }], subject: '', html: '', text: '', sms: null, sample: true }); });
    }, 500);
    return () => { clearTimeout(h); controller.abort(); };
  }, [tpl, form, orderId]);

  const issuesFor = (field: string): TemplateIssue[] => preview?.issues.filter((i) => i.field === field) ?? [];
  const hasIssues = (preview?.issues.length ?? 0) > 0;

  const set = (patch: Partial<Form>) => setForm((f) => (f ? { ...f, ...patch } : f));

  const insertVariable = (path: string) => {
    const el = lastFocus.current;
    const token = `{{${path}}}`;
    if (!el || !form) { toast.info(t('editor.focusFirst')); return; }
    const field = el.dataset.field as keyof Form;
    const value = String(form[field] ?? '');
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    set({ [field]: value.slice(0, start) + token + value.slice(end) } as Partial<Form>);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(start + token.length, start + token.length); });
  };

  const run = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true);
    try { await fn(); toast.success(ok); } catch (e: any) { toast.error(e?.message || tc('unknownError')); } finally { setBusy(false); }
  };

  const save = () => run(async () => {
    if (!tpl || !form) return;
    const d = await api.update(tpl.id, form);
    setTpl(d);
    setForm(Object.fromEntries(FIELDS.map((f) => [f, d[f] ?? (f === 'sendDelayMinutes' ? 0 : '')])) as Form);
    setVersions(null);
    onChanged();
  }, t('editor.saved'));

  const customize = () => run(async () => {
    if (!tpl) return;
    const d = await api.customize(tpl.id);
    onChanged();
    await load(d.id);
  }, t('editor.customized'));

  const sendTest = () => run(async () => {
    if (!tpl || !form) return;
    await api.testSend(tpl.id, { recipient: testRecipient, orderId: orderId || undefined, subject: form.subject ?? undefined, bodyHtml: form.bodyHtml ?? undefined, bodyText: form.bodyText ?? undefined });
    setTestOpen(false);
  }, t('editor.testQueued'));

  const openVersions = async () => {
    setVersionsOpen(true);
    if (!tpl || versions) return;
    try { setVersions(await api.versions(tpl.id)); } catch (e: any) { toast.error(e?.message || tc('unknownError')); }
  };
  const restore = (v: TemplateVersion) => run(async () => {
    if (!tpl) return;
    const d = await api.restore(tpl.id, v.id);
    setTpl(d);
    setForm(Object.fromEntries(FIELDS.map((f) => [f, d[f] ?? (f === 'sendDelayMinutes' ? 0 : '')])) as Form);
    setVersions(null);
    setVersionsOpen(false);
    onChanged();
  }, t('editor.restored'));

  const requestClose = () => (dirty ? setConfirmClose(true) : onClose());

  const bind = (field: keyof Form) => ({
    'data-field': field,
    onFocus: (e: React.FocusEvent<HTMLTextAreaElement | HTMLInputElement>) => { lastFocus.current = e.currentTarget; },
    disabled: !editable,
  });

  const issueBox = (field: string) => {
    const list = issuesFor(field);
    if (!list.length) return null;
    return (
      <ul className="mt-1 space-y-0.5 text-[0.6875rem] text-kp-danger">
        {list.map((i, idx) => <li key={idx}>{t('editor.line', { line: i.line })}: {i.message}</li>)}
      </ul>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-sm animate-fade-in" onClick={requestClose}>
      <div className="flex h-full w-full max-w-6xl flex-col border-l border-kp-border bg-kp-bg-secondary shadow-2xl animate-slide-in-right overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* header */}
        <div className="flex items-center justify-between gap-3 border-b border-kp-border px-6 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-sm font-bold uppercase tracking-wider text-kp-text-primary">{tpl ? te(tpl.event) : '…'}</h3>
              {tpl && <LevelBadge level={tpl.resolvedFrom} />}
              {tpl && <span className="rounded-full border border-kp-border px-2 py-0.5 text-[0.625rem] font-bold uppercase text-kp-text-tertiary">{t(`channel.${tpl.channel}`)} · {tpl.locale}</span>}
              {tpl && tpl.version > 0 && <span className="text-[0.625rem] text-kp-text-tertiary">v{tpl.version}</span>}
            </div>
            <p className="text-[0.6875rem] text-kp-text-tertiary">{t('editor.transactionalNote')}</p>
          </div>
          <div className="flex items-center gap-2">
            {tpl && !tpl.isSystemDefault && (
              <button type="button" onClick={openVersions} className="flex items-center gap-1.5 rounded-kp-md border border-kp-border px-3 py-1.5 text-xs font-semibold text-kp-text-secondary hover:text-kp-text-primary"><ClockIcon className="h-3.5 w-3.5" /> {t('editor.versions')}</button>
            )}
            {canTestSend && tpl && (
              <button type="button" onClick={() => setTestOpen(true)} className="flex items-center gap-1.5 rounded-kp-md border border-kp-border px-3 py-1.5 text-xs font-semibold text-kp-text-secondary hover:text-kp-text-primary"><PaperAirplaneIcon className="h-3.5 w-3.5" /> {t('editor.testSend')}</button>
            )}
            <button type="button" onClick={requestClose} className="text-kp-text-tertiary hover:text-kp-text-primary"><XMarkIcon className="h-5 w-5" /></button>
          </div>
        </div>

        {loadError && (
          <div className="m-6 flex items-center gap-2 rounded-kp-md border border-kp-danger/40 bg-kp-danger-muted px-3.5 py-2 text-xs text-kp-danger"><ExclamationTriangleIcon className="h-4 w-4" />{loadError}</div>
        )}

        {tpl && form && (
          <div className="flex min-h-0 flex-1">
            {/* left: form */}
            <div className="flex w-1/2 flex-col overflow-y-auto border-r border-kp-border p-6 space-y-4">
              {!editable && (
                <div className="flex items-start gap-2 rounded-kp-md border border-kp-info/30 bg-kp-info/10 px-3.5 py-2.5 text-xs text-kp-text-secondary">
                  <InformationCircleIcon className="h-4 w-4 shrink-0 text-kp-info" />
                  <div className="flex-1">
                    {tpl.editable ? t('editor.readOnlyRole') : t('editor.inheritedFrom', { level: t(`level.${tpl.resolvedFrom}`) })}
                    {!tpl.editable && canCreate && (
                      <button type="button" onClick={customize} disabled={busy} className="ml-2 font-semibold text-kp-accent hover:underline">{t('table.customize')}</button>
                    )}
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label className={labelCls}>{t('editor.name')}</label>
                <input {...bind('name')} value={form.name} onChange={(e) => set({ name: e.target.value })} className={inputCls} maxLength={120} />
              </div>

              {tpl.channel === 'EMAIL' ? (
                <>
                  <div className="space-y-1.5">
                    <label className={labelCls}>{t('editor.subject')}</label>
                    <input {...bind('subject')} value={form.subject ?? ''} onChange={(e) => set({ subject: e.target.value })} className={inputCls} maxLength={255} />
                    {issueBox('subject')}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className={labelCls}>{t('editor.senderName')}</label>
                      <input {...bind('senderName')} value={form.senderName ?? ''} onChange={(e) => set({ senderName: e.target.value })} className={inputCls} />
                    </div>
                    <div className="space-y-1.5">
                      <label className={labelCls}>{t('editor.replyTo')}</label>
                      <input {...bind('replyTo')} value={form.replyTo ?? ''} onChange={(e) => set({ replyTo: e.target.value })} className={inputCls} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className={labelCls}>{t('editor.bodyHtml')}</label>
                    <textarea {...bind('bodyHtml')} value={form.bodyHtml ?? ''} onChange={(e) => set({ bodyHtml: e.target.value })} rows={12} spellCheck={false} className={`${inputCls} font-mono leading-relaxed`} />
                    {issueBox('bodyHtml')}
                  </div>
                  <div className="space-y-1.5">
                    <label className={labelCls}>{t('editor.bodyTextAlt')}</label>
                    <textarea {...bind('bodyText')} value={form.bodyText ?? ''} onChange={(e) => set({ bodyText: e.target.value })} rows={4} className={inputCls} placeholder={t('editor.bodyTextAltHint')} />
                    {issueBox('bodyText')}
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <label className={labelCls}>{t('editor.smsSenderId')}</label>
                    <input {...bind('smsSenderId')} value={form.smsSenderId ?? ''} onChange={(e) => set({ smsSenderId: e.target.value })} className={inputCls} maxLength={11} />
                  </div>
                  <div className="space-y-1.5">
                    <label className={labelCls}>{t('editor.bodyText')}</label>
                    <textarea {...bind('bodyText')} value={form.bodyText ?? ''} onChange={(e) => set({ bodyText: e.target.value })} rows={6} className={inputCls} />
                    {preview?.sms && (
                      <div className="flex items-center gap-3 text-[0.6875rem] text-kp-text-tertiary">
                        <span>{t('editor.smsCount', { chars: preview.sms.charCount, segments: preview.sms.segments })}</span>
                        <span className={`rounded-full border px-2 py-0.5 font-mono ${preview.sms.encoding === 'UCS-2' ? 'border-kp-warning/40 text-kp-warning' : 'border-kp-border'}`}>{preview.sms.encoding}</span>
                        {preview.sms.encoding === 'UCS-2' && <span className="text-kp-warning">{t('editor.turkishWarning')}</span>}
                      </div>
                    )}
                    {issueBox('bodyText')}
                  </div>
                </>
              )}

              <div className="space-y-1.5">
                <label className={labelCls}>{t('editor.delay')}</label>
                <input {...bind('sendDelayMinutes')} type="number" min={0} max={10080} value={form.sendDelayMinutes} onChange={(e) => set({ sendDelayMinutes: Math.max(0, Number(e.target.value) || 0) })} className={`${inputCls} w-32`} />
              </div>

              {/* variables */}
              <div className="space-y-1.5">
                <label className={labelCls}>{t('editor.variables')}</label>
                <p className="text-[0.6875rem] text-kp-text-tertiary">{t('editor.variablesHint')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {vars.map((v) => (
                    <button key={v.path} type="button" disabled={!editable} onClick={() => insertVariable(v.path)} title={`${v.label} — ${typeof v.sample === 'object' ? '[…]' : String(v.sample)}`} className="rounded-kp-md border border-kp-border bg-kp-bg-primary px-2 py-1 font-mono text-[0.6875rem] text-kp-text-secondary hover:border-kp-accent hover:text-kp-accent disabled:opacity-50">
                      {`{{${v.path}}}`}
                    </button>
                  ))}
                </div>
                <p className="text-[0.625rem] text-kp-text-tertiary">{t('editor.helpersHint')}</p>
              </div>
            </div>

            {/* right: preview */}
            <div className="flex w-1/2 flex-col overflow-hidden bg-kp-bg-primary/30">
              <div className="flex flex-wrap items-center gap-2 border-b border-kp-border px-4 py-2">
                <span className="text-[0.6875rem] font-bold uppercase tracking-wider text-kp-text-tertiary">{t('editor.preview')}</span>
                <select value={orderId} onChange={(e) => setOrderId(e.target.value)} className="rounded-kp-md border border-kp-border bg-kp-bg-primary px-2 py-1 text-[0.6875rem] text-kp-text-primary">
                  <option value="">{t('editor.sampleData')}</option>
                  {orders.map((o) => <option key={o.id} value={o.id}>{o.orderNumber} · {o.customerName}</option>)}
                </select>
                {tpl.channel === 'EMAIL' && (
                  <div className="ml-auto flex items-center gap-1">
                    <button type="button" onClick={() => setPreviewWidth('desktop')} className={`rounded-kp-md p-1 ${previewWidth === 'desktop' ? 'bg-kp-accent/10 text-kp-accent' : 'text-kp-text-tertiary'}`}><ComputerDesktopIcon className="h-4 w-4" /></button>
                    <button type="button" onClick={() => setPreviewWidth('mobile')} className={`rounded-kp-md p-1 ${previewWidth === 'mobile' ? 'bg-kp-accent/10 text-kp-accent' : 'text-kp-text-tertiary'}`}><DevicePhoneMobileIcon className="h-4 w-4" /></button>
                  </div>
                )}
              </div>
              <div className="flex-1 overflow-auto p-4">
                {hasIssues ? (
                  <div className="flex items-start gap-2 rounded-kp-md border border-kp-danger/40 bg-kp-danger-muted px-3.5 py-2.5 text-xs text-kp-danger">
                    <ExclamationTriangleIcon className="h-4 w-4 shrink-0" />
                    <div>{t('editor.fixIssues', { count: preview!.issues.length })}</div>
                  </div>
                ) : tpl.channel === 'EMAIL' ? (
                  <div className="mx-auto transition-all" style={{ width: previewWidth === 'mobile' ? 375 : '100%' }}>
                    <div className="mb-2 rounded-kp-md border border-kp-border bg-kp-bg-secondary px-3 py-2 text-xs"><span className="text-kp-text-tertiary">{t('editor.subject')}:</span> <span className="font-semibold text-kp-text-primary">{preview?.subject}</span></div>
                    <iframe title="preview" sandbox="" srcDoc={preview?.html ?? ''} className="h-[70vh] w-full rounded-kp-md border border-kp-border bg-white" />
                  </div>
                ) : (
                  <div className="mx-auto w-[320px] rounded-[2rem] border-8 border-slate-800 bg-slate-100 p-4 pt-8">
                    <div className="mb-1 text-center text-[0.625rem] text-slate-500">{form.smsSenderId || t('editor.smsSenderId')}</div>
                    <div className="rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-xs leading-relaxed text-slate-800 shadow whitespace-pre-wrap">{preview?.text}</div>
                  </div>
                )}
                {preview?.sample && !hasIssues && <p className="mt-3 text-center text-[0.625rem] text-kp-text-tertiary">{t('editor.sampleNote')}</p>}
              </div>
            </div>
          </div>
        )}

        {/* footer */}
        <div className="flex items-center justify-between gap-3 border-t border-kp-border bg-kp-bg-primary/20 px-6 py-4">
          <div className="text-[0.6875rem] text-kp-text-tertiary">{dirty ? t('editor.unsaved') : ''}</div>
          <div className="flex items-center gap-3">
            {confirmClose ? (
              <>
                <span className="text-xs text-kp-warning">{t('editor.discardConfirm')}</span>
                <button type="button" onClick={() => setConfirmClose(false)} className="rounded-kp-md border border-kp-border px-3.5 py-1.5 text-xs font-semibold text-kp-text-secondary">{tc('actions.cancel')}</button>
                <button type="button" onClick={onClose} className="rounded-kp-md bg-kp-danger px-3.5 py-1.5 text-xs font-semibold text-white">{t('editor.discard')}</button>
              </>
            ) : (
              <>
                <button type="button" onClick={requestClose} className="rounded-kp-md border border-kp-border px-3.5 py-1.5 text-xs font-semibold text-kp-text-secondary">{tc('actions.cancel')}</button>
                {editable && (
                  <button type="button" onClick={save} disabled={busy || !dirty || hasIssues} className="flex items-center gap-2 rounded-kp-md bg-kp-accent px-4 py-1.5 text-xs font-semibold text-white hover:bg-kp-accent-hover disabled:opacity-50">
                    {busy && <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />}{tc('actions.save')}
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* test send modal */}
        {testOpen && tpl && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50 p-4" onClick={() => setTestOpen(false)}>
            <div className="w-full max-w-md rounded-kp-lg border border-kp-border bg-kp-bg-secondary p-6 shadow-kp-elevated" onClick={(e) => e.stopPropagation()}>
              <h4 className="text-sm font-bold uppercase tracking-wider text-kp-text-primary">{t('editor.testSend')}</h4>
              <p className="mt-1 text-[0.6875rem] text-kp-text-tertiary">{t('editor.testHint')}</p>
              <input autoFocus value={testRecipient} onChange={(e) => setTestRecipient(e.target.value)} placeholder={tpl.channel === 'EMAIL' ? 'ornek@firma.com' : '+90 5xx xxx xx xx'} className={`${inputCls} mt-3`} />
              <div className="mt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setTestOpen(false)} className="rounded-kp-md border border-kp-border px-3.5 py-1.5 text-xs font-semibold text-kp-text-secondary">{tc('actions.cancel')}</button>
                <button type="button" onClick={sendTest} disabled={busy || !testRecipient || hasIssues} className="flex items-center gap-2 rounded-kp-md bg-kp-accent px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-50"><PaperAirplaneIcon className="h-3.5 w-3.5" />{t('editor.send')}</button>
              </div>
            </div>
          </div>
        )}

        {/* versions panel */}
        {versionsOpen && tpl && (
          <div className="absolute inset-0 z-10 flex justify-end bg-black/40" onClick={() => setVersionsOpen(false)}>
            <div className="flex h-full w-full max-w-lg flex-col border-l border-kp-border bg-kp-bg-secondary shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between border-b border-kp-border px-5 py-4">
                <h4 className="text-sm font-bold uppercase tracking-wider text-kp-text-primary">{t('editor.versions')}</h4>
                <button type="button" onClick={() => setVersionsOpen(false)} className="text-kp-text-tertiary hover:text-kp-text-primary"><XMarkIcon className="h-5 w-5" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-5 space-y-3">
                {!versions ? <p className="text-xs text-kp-text-tertiary">…</p> : versions.length === 0 ? <p className="text-xs text-kp-text-tertiary">{t('editor.noVersions')}</p> : versions.map((v) => {
                  const bodyField = tpl.channel === 'EMAIL' ? 'bodyHtml' : 'bodyText';
                  const changed = ['name', 'subject', bodyField, 'sendDelayMinutes'].filter((f) => (v.snapshot[f] ?? '') !== (tpl as any)[f]);
                  return (
                    <div key={v.id} className="rounded-kp-md border border-kp-border bg-kp-bg-primary p-3">
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-semibold text-kp-text-primary">v{v.version} <span className="font-normal text-kp-text-tertiary">· {new Date(v.createdAt).toLocaleString('tr-TR')}</span></div>
                        {editable && <button type="button" onClick={() => restore(v)} disabled={busy} className="flex items-center gap-1 text-xs font-semibold text-kp-accent hover:underline"><ArrowUturnLeftIcon className="h-3.5 w-3.5" /> {t('editor.restore')}</button>}
                      </div>
                      <div className="mt-2 space-y-2">
                        {changed.length === 0 && <p className="text-[0.6875rem] text-kp-text-tertiary">{t('editor.sameAsCurrent')}</p>}
                        {changed.map((f) => (
                          <div key={f} className="grid grid-cols-2 gap-2 text-[0.6875rem]">
                            <div><div className="mb-0.5 font-bold uppercase text-kp-text-tertiary">{f} · v{v.version}</div><pre className="max-h-32 overflow-auto whitespace-pre-wrap rounded bg-kp-danger/5 p-2 font-mono text-kp-text-secondary">{String(v.snapshot[f] ?? '')}</pre></div>
                            <div><div className="mb-0.5 font-bold uppercase text-kp-text-tertiary">{f} · {t('editor.current')}</div><pre className="max-h-32 overflow-auto whitespace-pre-wrap rounded bg-kp-success/5 p-2 font-mono text-kp-text-secondary">{String((tpl as any)[f] ?? '')}</pre></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
