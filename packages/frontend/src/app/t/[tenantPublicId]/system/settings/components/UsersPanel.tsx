'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowPathIcon, ExclamationTriangleIcon, UserPlusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/ui/Toast';
import { usePermission } from '@/hooks/usePermission';
import { useUsers, type UserRow } from '../hooks/useUsers';
import { useRoles } from '../hooks/useRoles';
import { useInvitations } from '../hooks/useInvitations';
import UsersTable from './UsersTable';
import InviteUserModal from './InviteUserModal';
import PendingInvitations from './PendingInvitations';
import DeleteConfirmModal from './DeleteConfirmModal';

/** Kullanicilar sekmesi: hook'lar burada, tablo ve modallar sunum. */
export default function UsersPanel() {
  const t = useTranslations('system.users');
  const tc = useTranslations('common');
  const toast = useToast();
  const { user: me } = useAuth();
  const { can } = usePermission();
  const users = useUsers();
  const rolesApi = useRoles();
  const invitations = useInvitations();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [roleTarget, setRoleTarget] = useState<UserRow | null>(null);
  const [storesTarget, setStoresTarget] = useState<UserRow | null>(null);
  const [removeTarget, setRemoveTarget] = useState<UserRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // rol degistir formu
  const [roleId, setRoleId] = useState('');
  const [storeId, setStoreId] = useState('');
  // magaza erisimi formu
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);

  const openRole = (u: UserRow) => {
    setModalError(null);
    setRoleId(u.scopes[0]?.roleId ?? '');
    setStoreId(u.scopes[0]?.storeId ?? '');
    setRoleTarget(u);
  };
  const openStores = (u: UserRow) => {
    setModalError(null);
    setSelectedStoreIds(u.allowedStoreIds ?? []);
    setStoresTarget(u);
  };

  const run = async (fn: () => Promise<void>, okMsg: string, close: () => void) => {
    setBusy(true);
    setModalError(null);
    try {
      await fn();
      toast.success(okMsg);
      close();
    } catch (err: any) {
      // 400/403 govdesindeki mesaj ("last agency_owner", "do not hold"...) aynen gosterilir.
      setModalError(err?.message || tc('unknownError'));
    } finally {
      setBusy(false);
    }
  };

  const assignableRoles = rolesApi.roles.filter((r) => r.key !== 'super_admin');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-2 border-b border-kp-border">
        <div>
          <h3 className="text-sm font-bold text-kp-text-primary uppercase tracking-wider">{t('title')}</h3>
          <p className="text-[0.6875rem] text-kp-text-tertiary">{t('subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => { users.refresh(); invitations.refresh(); }} className="flex items-center gap-1.5 rounded-kp-md border border-kp-border px-3 py-1.5 text-xs font-semibold text-kp-text-secondary hover:text-kp-text-primary">
            <ArrowPathIcon className={`h-3.5 w-3.5 ${users.isLoading ? 'animate-spin' : ''}`} /> {tc('actions.refresh')}
          </button>
          {can('users.manage') && (
          <button onClick={() => setInviteOpen(true)} className="flex items-center gap-1.5 rounded-kp-md bg-kp-accent hover:bg-kp-accent-hover text-white px-3 py-1.5 text-xs font-semibold">
            <UserPlusIcon className="h-3.5 w-3.5" /> {t('invite')}
          </button>
          )}
        </div>
      </div>

      {users.error ? (
        <div className="flex items-center gap-3 rounded-kp-md border border-kp-danger/20 bg-kp-danger/10 px-4 py-3">
          <ExclamationTriangleIcon className="h-5 w-5 text-kp-danger flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-kp-danger">{t('loadFailed')}</p>
            <p className="text-xs text-kp-danger/80 mt-0.5">{users.error}</p>
          </div>
          <button onClick={users.refresh} className="text-xs font-medium text-kp-danger hover:underline">{tc('actions.retry')}</button>
        </div>
      ) : (
        <UsersTable
          users={users.users}
          roles={rolesApi.roles}
          currentUserId={me?.id ?? null}
          filters={users.filters}
          onFilters={users.updateFilters}
          page={users.page}
          pageCount={users.pageCount}
          total={users.total}
          onPage={users.setPage}
          isLoading={users.isLoading}
          onEditRole={openRole}
          onEditStores={openStores}
          onRemove={(u) => { setModalError(null); setRemoveTarget(u); }}
        />
      )}

      <PendingInvitations
        invitations={invitations.invitations}
        roles={rolesApi.roles}
        stores={users.availableStores}
        isLoading={invitations.isLoading}
        error={invitations.error}
        onRetry={invitations.refresh}
        onResend={invitations.resend}
        onRevoke={invitations.revoke}
      />

      {inviteOpen && (
        <InviteUserModal
          roles={assignableRoles}
          stores={users.availableStores}
          onClose={() => setInviteOpen(false)}
          onInvite={invitations.createInvitation}
        />
      )}

      {roleTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-kp-bg-secondary border border-kp-border rounded-kp-lg shadow-kp-elevated overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-kp-border">
              <div>
                <h3 className="text-sm font-bold text-kp-text-primary uppercase tracking-wider">{t('changeRole')}</h3>
                <p className="text-[0.6875rem] text-kp-text-tertiary">{roleTarget.name} ({roleTarget.email})</p>
              </div>
              <button onClick={() => setRoleTarget(null)} className="text-kp-text-tertiary hover:text-kp-text-primary"><XMarkIcon className="h-5 w-5" /></button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); run(() => users.changeRole(roleTarget.id, { roleId, ...(storeId ? { storeId } : {}) }), t('roleChanged'), () => setRoleTarget(null)); }}>
              <div className="p-6 space-y-4">
                <p className="text-[0.6875rem] text-kp-text-tertiary">{t('changeRoleNote')}</p>
                <div className="space-y-1.5">
                  <label className="block text-[0.6875rem] font-bold text-kp-text-primary uppercase tracking-wider">{t('colRole')}</label>
                  <select value={roleId} onChange={(e) => setRoleId(e.target.value)} required className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3 py-1.5 text-xs text-kp-text-primary">
                    <option value="" disabled>{tc('actions.select')}</option>
                    {assignableRoles.map((r) => (<option key={r.id} value={r.id}>{r.name}</option>))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[0.6875rem] font-bold text-kp-text-primary uppercase tracking-wider">{t('scope')}</label>
                  <select value={storeId} onChange={(e) => setStoreId(e.target.value)} className="w-full bg-kp-bg-primary border border-kp-border rounded-kp-md px-3 py-1.5 text-xs text-kp-text-primary">
                    <option value="">{t('scopeAgency')}</option>
                    {users.availableStores.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
                  </select>
                </div>
                {modalError && (
                  <div className="flex items-start gap-2 p-3 text-xs rounded-kp-md bg-kp-danger/10 border border-kp-danger/20 text-kp-danger">
                    <ExclamationTriangleIcon className="h-4 w-4 flex-shrink-0 mt-0.5" />{modalError}
                  </div>
                )}
              </div>
              <div className="px-6 py-4 border-t border-kp-border bg-kp-bg-primary/20 flex justify-end gap-3">
                <button type="button" onClick={() => setRoleTarget(null)} className="rounded-kp-md border border-kp-border px-3.5 py-1.5 text-xs font-semibold text-kp-text-secondary">{tc('actions.cancel')}</button>
                <button type="submit" disabled={busy || !roleId} className="flex items-center gap-2 rounded-kp-md bg-kp-accent hover:bg-kp-accent-hover text-white px-4 py-1.5 text-xs font-semibold disabled:opacity-50">
                  {busy && <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />}{tc('actions.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {storesTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-kp-bg-secondary border border-kp-border rounded-kp-lg shadow-kp-elevated overflow-hidden animate-scale-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-kp-border">
              <div>
                <h3 className="text-sm font-bold text-kp-text-primary uppercase tracking-wider">{t('editStores')}</h3>
                <p className="text-[0.6875rem] text-kp-text-tertiary">{storesTarget.name} ({storesTarget.email})</p>
              </div>
              <button onClick={() => setStoresTarget(null)} className="text-kp-text-tertiary hover:text-kp-text-primary"><XMarkIcon className="h-5 w-5" /></button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); run(() => users.updateStores(storesTarget.id, selectedStoreIds), t('storesSaved'), () => setStoresTarget(null)); }}>
              <div className="p-6 space-y-3">
                <p className="text-[0.6875rem] text-kp-text-tertiary">{t('storesNote')}</p>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {users.availableStores.map((store) => {
                    const checked = selectedStoreIds.includes(store.id);
                    return (
                      <label key={store.id} className={`flex items-center gap-3 p-3 rounded-kp-md border cursor-pointer transition-all ${checked ? 'bg-kp-accent/10 border-kp-accent/40' : 'bg-kp-bg-primary border-kp-border hover:border-kp-border-hover'}`}>
                        <input type="checkbox" checked={checked} onChange={() => setSelectedStoreIds((p) => (checked ? p.filter((id) => id !== store.id) : [...p, store.id]))} className="h-4 w-4 rounded border-kp-border text-kp-accent" />
                        <div>
                          <div className="text-xs font-bold text-kp-text-primary">{store.name}</div>
                          <div className="text-[0.625rem] text-kp-text-tertiary font-mono">{store.publicId}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
                {modalError && (
                  <div className="flex items-start gap-2 p-3 text-xs rounded-kp-md bg-kp-danger/10 border border-kp-danger/20 text-kp-danger">
                    <ExclamationTriangleIcon className="h-4 w-4 flex-shrink-0 mt-0.5" />{modalError}
                  </div>
                )}
              </div>
              <div className="px-6 py-4 border-t border-kp-border bg-kp-bg-primary/20 flex justify-end gap-3">
                <button type="button" onClick={() => setStoresTarget(null)} className="rounded-kp-md border border-kp-border px-3.5 py-1.5 text-xs font-semibold text-kp-text-secondary">{tc('actions.cancel')}</button>
                <button type="submit" disabled={busy} className="flex items-center gap-2 rounded-kp-md bg-kp-accent hover:bg-kp-accent-hover text-white px-4 py-1.5 text-xs font-semibold disabled:opacity-50">
                  {busy && <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />}{tc('actions.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {removeTarget && (
        <DeleteConfirmModal
          title={t('remove')}
          confirmLabel={t('remove')}
          isBusy={busy}
          error={modalError}
          onClose={() => setRemoveTarget(null)}
          onConfirm={() => run(() => users.removeUser(removeTarget.id), t('removed'), () => setRemoveTarget(null))}
        >
          <p>{t.rich('removeConfirm', { name: removeTarget.name, strong: (c) => <span className="font-semibold text-kp-text-primary">{c}</span> })}</p>
          <p className="text-xs text-kp-text-tertiary">{t('removeNote')}</p>
        </DeleteConfirmModal>
      )}
    </div>
  );
}
