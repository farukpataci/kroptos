'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowPathIcon, ExclamationTriangleIcon, FolderIcon, LockClosedIcon, PlusIcon, ShieldCheckIcon, TrashIcon, UsersIcon } from '@heroicons/react/24/outline';
import { useToast } from '@/components/ui/Toast';
import { useRoles, type RoleRow } from '../hooks/useRoles';
import PermissionMatrix from './PermissionMatrix';
import DeleteConfirmModal from './DeleteConfirmModal';

/** Roller & Yetkiler sekmesi: /api/system/roles + /api/system/permissions. Yerel mock yok. */
export default function RoleList() {
  const t = useTranslations('system.roles');
  const tc = useTranslations('common');
  const toast = useToast();
  const { roles, catalog, isLoading, error, refresh, createRole, updateRole, deleteRole } = useRoles();

  const [selectedId, setSelectedId] = useState<string>('');
  const [draft, setDraft] = useState<string[]>([]);
  const [draftName, setDraftName] = useState('');
  const [draftDesc, setDraftDesc] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [addError, setAddError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<RoleRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const selected = useMemo(() => roles.find((r) => r.id === selectedId) ?? roles[0], [roles, selectedId]);

  // Secim degisince taslagi sunucu halinden yeniden kur.
  useEffect(() => {
    if (!selected) return;
    setSelectedId(selected.id);
    setDraft(selected.permissions);
    setDraftName(selected.name);
    setDraftDesc(selected.description ?? '');
    setSaveError(null);
  }, [selected?.id, selected?.permissions.join(','), selected?.name, selected?.description]);

  const dirty = !!selected && (
    draft.slice().sort().join(',') !== selected.permissions.slice().sort().join(',') ||
    draftName !== selected.name ||
    draftDesc !== (selected.description ?? '')
  );

  const toggle = (key: string) => setDraft((p) => (p.includes(key) ? p.filter((k) => k !== key) : [...p, key]));

  const save = async () => {
    if (!selected) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await updateRole(selected.id, { name: draftName, description: draftDesc, permissions: draft });
      toast.success(t('saved'));
    } catch (err: any) {
      // "Cannot grant permissions you do not hold: ..." gibi backend mesajlari aynen.
      setSaveError(err?.message || tc('unknownError'));
    } finally {
      setIsSaving(false);
    }
  };

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError(null);
    try {
      const created = await createRole({ name: newName, description: newDesc || undefined, permissions: [] });
      toast.success(t('created', { name: created.name }));
      setIsAdding(false);
      setNewName('');
      setNewDesc('');
      setSelectedId(created.id);
    } catch (err: any) {
      setAddError(err?.message || tc('unknownError'));
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setDeleteError(null);
    try {
      await deleteRole(deleteTarget.id);
      toast.success(t('deleted', { name: deleteTarget.name }));
      setDeleteTarget(null);
      if (selectedId === deleteTarget.id) setSelectedId('');
    } catch (err: any) {
      setDeleteError(err?.message || tc('unknownError'));
    }
  };

  if (error) {
    return (
      <div className="flex items-center gap-3 rounded-kp-md border border-kp-danger/20 bg-kp-danger/10 px-4 py-3">
        <ExclamationTriangleIcon className="h-5 w-5 text-kp-danger flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-kp-danger">{t('loadFailed')}</p>
          <p className="text-xs text-kp-danger/80 mt-0.5">{error}</p>
        </div>
        <button onClick={refresh} className="text-xs font-medium text-kp-danger hover:underline">{tc('actions.retry')}</button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-2 border-b border-kp-border">
        <div>
          <h3 className="text-sm font-bold text-kp-text-primary uppercase tracking-wider">{t('title')}</h3>
          <p className="text-[0.6875rem] text-kp-text-tertiary">{t('subtitle')}</p>
        </div>
        <button onClick={refresh} className="flex items-center gap-1.5 rounded-kp-md border border-kp-border px-3 py-1.5 text-xs font-semibold text-kp-text-secondary hover:text-kp-text-primary">
          <ArrowPathIcon className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} /> {tc('actions.refresh')}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sol: rol listesi */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[0.6875rem] font-bold text-kp-text-tertiary uppercase tracking-wider">{t('listTitle')}</span>
            {!isAdding && (
              <button onClick={() => setIsAdding(true)} className="text-[0.625rem] font-semibold text-kp-accent hover:text-kp-accent-hover flex items-center gap-0.5">
                <PlusIcon className="h-3.5 w-3.5" /> {t('newRole')}
              </button>
            )}
          </div>

          {isAdding && (
            <form onSubmit={add} className="space-y-2 border border-kp-border/40 p-3 rounded-kp-md bg-kp-bg-secondary">
              <input type="text" required minLength={2} placeholder={t('namePlaceholder')} value={newName} onChange={(e) => setNewName(e.target.value)} className="w-full bg-kp-bg-primary border border-kp-border rounded px-2.5 py-1 text-xs text-kp-text-primary focus:outline-hidden" />
              <textarea placeholder={t('descPlaceholder')} value={newDesc} onChange={(e) => setNewDesc(e.target.value)} className="w-full bg-kp-bg-primary border border-kp-border rounded px-2.5 py-1 text-xs text-kp-text-primary focus:outline-hidden h-14 resize-none" />
              {addError && <p className="text-[0.6875rem] text-kp-danger">{addError}</p>}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => { setIsAdding(false); setAddError(null); }} className="text-[0.625rem] font-semibold text-kp-text-tertiary hover:underline">{tc('actions.cancel')}</button>
                <button type="submit" className="bg-kp-accent text-white px-2 py-0.5 rounded text-[0.625rem] font-semibold hover:bg-kp-accent-hover">{t('addRole')}</button>
              </div>
            </form>
          )}

          <div className="space-y-2">
            {isLoading && roles.length === 0 ? (
              Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 rounded-kp-md bg-kp-bg-tertiary animate-pulse" />)
            ) : roles.length === 0 ? (
              <p className="text-xs text-kp-text-tertiary py-6 text-center">{t('empty')}</p>
            ) : (
              roles.map((role) => {
                const isSelected = role.id === selected?.id;
                const canDelete = !role.isSystem && role.userCount === 0;
                return (
                  <div key={role.id} onClick={() => setSelectedId(role.id)} className={`group relative w-full text-left p-3 rounded-kp-md border transition-all cursor-pointer ${isSelected ? 'bg-kp-accent/5 border-kp-accent/30 shadow-xs' : 'bg-kp-bg-secondary border-kp-border hover:bg-kp-bg-hover'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 font-semibold text-xs text-kp-text-primary truncate">
                        {role.isSystem && <LockClosedIcon className="h-3 w-3 text-kp-text-tertiary flex-shrink-0" />}
                        {role.name}
                      </div>
                      {/* Sistem rolu ve uzerinde kullanici olan rol: backend 403/400 verir, UI'da disabled. */}
                      <button
                        onClick={(e) => { e.stopPropagation(); setDeleteError(null); setDeleteTarget(role); }}
                        disabled={!canDelete}
                        title={role.isSystem ? t('systemHint') : role.userCount > 0 ? t('inUseHint', { count: role.userCount }) : t('deleteRole')}
                        className="p-0.5 text-kp-text-tertiary hover:text-kp-danger rounded hover:bg-kp-bg-hover transition-all disabled:opacity-25 disabled:cursor-not-allowed disabled:hover:text-kp-text-tertiary"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <p className="text-[0.625rem] text-kp-text-tertiary mt-1 line-clamp-2 leading-relaxed">{role.description || (role.isSystem ? t('systemRole') : t('customRole'))}</p>
                    <div className="flex items-center gap-3 mt-2 text-[0.5625rem] text-kp-text-tertiary">
                      <span className="flex items-center gap-1"><FolderIcon className="h-3 w-3" />{t('permCount', { count: role.permissions.length })}</span>
                      <span className="flex items-center gap-1"><UsersIcon className="h-3 w-3" />{t('userCount', { count: role.userCount })}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Sag: izin matrisi */}
        <div className="lg:col-span-2 space-y-4">
          <div className="border border-kp-border rounded-kp-md p-5 bg-kp-bg-secondary space-y-4 shadow-xs">
            {!selected ? (
              <p className="text-xs text-kp-text-tertiary py-10 text-center">{t('selectRole')}</p>
            ) : (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    {selected.isSystem ? (
                      <div className="flex items-center gap-2 text-sm font-bold text-kp-text-primary"><ShieldCheckIcon className="h-4 w-4 text-kp-accent" />{selected.name}</div>
                    ) : (
                      <input value={draftName} onChange={(e) => setDraftName(e.target.value)} className="w-full max-w-sm bg-kp-bg-primary border border-kp-border rounded-kp-md px-3 py-1.5 text-sm font-bold text-kp-text-primary focus:outline-hidden focus:border-kp-accent" />
                    )}
                    {selected.isSystem ? (
                      <p className="text-[0.6875rem] text-kp-text-tertiary">{selected.description}</p>
                    ) : (
                      <input value={draftDesc} onChange={(e) => setDraftDesc(e.target.value)} placeholder={t('descPlaceholder')} className="w-full max-w-lg bg-kp-bg-primary border border-kp-border rounded-kp-md px-3 py-1 text-[0.6875rem] text-kp-text-secondary focus:outline-hidden focus:border-kp-accent" />
                    )}
                    <div className="text-[0.625rem] font-mono text-kp-text-tertiary">{selected.key}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {selected.isSystem ? (
                      <span className="inline-flex items-center gap-1 rounded-kp-sm bg-kp-bg-primary px-2 py-1 text-[0.625rem] font-semibold text-kp-text-tertiary border border-kp-border" title={t('systemHint')}>
                        <LockClosedIcon className="h-3 w-3" /> {t('readOnly')}
                      </span>
                    ) : (
                      <button onClick={save} disabled={!dirty || isSaving} className="flex items-center gap-2 rounded-kp-md bg-kp-accent hover:bg-kp-accent-hover text-white px-4 py-1.5 text-xs font-semibold disabled:opacity-50">
                        {isSaving && <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />}{tc('actions.save')}
                      </button>
                    )}
                  </div>
                </div>

                {saveError && (
                  <div className="flex items-start gap-2 p-3 text-xs rounded-kp-md bg-kp-danger/10 border border-kp-danger/20 text-kp-danger">
                    <ExclamationTriangleIcon className="h-4 w-4 flex-shrink-0 mt-0.5" />{saveError}
                  </div>
                )}

                <PermissionMatrix groups={catalog} granted={draft} readOnly={selected.isSystem} onToggle={toggle} />
              </>
            )}
          </div>
        </div>
      </div>

      {deleteTarget && (
        <DeleteConfirmModal
          title={t('deleteRole')}
          isBusy={false}
          error={deleteError}
          onClose={() => setDeleteTarget(null)}
          onConfirm={remove}
        >
          <p>{t.rich('deleteConfirm', { name: deleteTarget.name, strong: (c) => <span className="font-semibold text-kp-text-primary">{c}</span> })}</p>
        </DeleteConfirmModal>
      )}
    </div>
  );
}
