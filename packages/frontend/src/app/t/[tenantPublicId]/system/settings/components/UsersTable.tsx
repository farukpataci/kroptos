'use client';

import { useTranslations } from 'next-intl';
import {
  BuildingStorefrontIcon,
  CheckCircleIcon,
  MagnifyingGlassIcon,
  PencilIcon,
  ShieldCheckIcon,
  UserMinusIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline';
import type { UserFilters, UserRow } from '../hooks/useUsers';
import type { RoleRow } from '../hooks/useRoles';

interface Props {
  users: UserRow[];
  roles: RoleRow[];
  currentUserId: string | null;
  filters: UserFilters;
  onFilters: (patch: Partial<UserFilters>) => void;
  page: number;
  pageCount: number;
  total: number;
  onPage: (p: number) => void;
  isLoading: boolean;
  onEditRole: (user: UserRow) => void;
  onEditStores: (user: UserRow) => void;
  onRemove: (user: UserRow) => void;
}

/** Sadece sunum: veri ve mutasyonlar UsersPanel/useUsers'ta. */
export default function UsersTable({ users, roles, currentUserId, filters, onFilters, page, pageCount, total, onPage, isLoading, onEditRole, onEditStores, onRemove }: Props) {
  const t = useTranslations('system.users');
  const tc = useTranslations('common');
  const initials = (name: string) => name.split(' ').map((n) => n[0]).join('').toUpperCase().substring(0, 2);
  const roleLabel = (key: string | null) => roles.find((r) => r.key === key)?.name ?? key ?? '—';

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:max-w-xs">
          <input
            type="text"
            value={filters.search}
            onChange={(e) => onFilters({ search: e.target.value })}
            placeholder={t('searchPlaceholder')}
            className="w-full bg-kp-bg-secondary border border-kp-border rounded-kp-md pl-9 pr-3.5 py-1.5 text-xs text-kp-text-primary placeholder:text-kp-text-tertiary focus:outline-hidden focus:border-kp-accent transition-colors"
          />
          <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-3.5 w-3.5 text-kp-text-tertiary" />
        </div>
        <div className="flex gap-2">
          <select value={filters.role} onChange={(e) => onFilters({ role: e.target.value })} className="bg-kp-bg-secondary border border-kp-border rounded-kp-md px-2.5 py-1.5 text-xs text-kp-text-primary">
            <option value="">{t('allRoles')}</option>
            {roles.map((r) => (<option key={r.id} value={r.key}>{r.name}</option>))}
          </select>
          <select value={filters.status} onChange={(e) => onFilters({ status: e.target.value as UserFilters['status'] })} className="bg-kp-bg-secondary border border-kp-border rounded-kp-md px-2.5 py-1.5 text-xs text-kp-text-primary">
            <option value="">{t('allStatuses')}</option>
            <option value="active">{t('active')}</option>
            <option value="inactive">{t('inactive')}</option>
          </select>
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="kp-table w-full text-left border-collapse text-theme-sm text-kp-text-secondary">
          <thead>
            <tr className="border-b border-kp-border text-[0.6875rem] font-semibold uppercase tracking-wider text-kp-text-tertiary bg-kp-bg-primary/30">
              <th className="py-3 px-4">{t('colUser')}</th>
              <th className="py-3 px-4">{t('colRole')}</th>
              <th className="py-3 px-4">{t('colStores')}</th>
              <th className="py-3 px-4">{t('colStatus')}</th>
              <th className="py-3 px-4 text-right">{t('colActions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-kp-border">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 5 }).map((_, j) => (<td key={j} className="py-4 px-4"><div className="h-3 rounded bg-kp-bg-tertiary animate-pulse w-3/4" /></td>))}</tr>
              ))
            ) : users.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-3xl">👥</span>
                    <p className="text-sm font-medium text-kp-text-secondary">{t('emptyTitle')}</p>
                    <p className="text-xs text-kp-text-tertiary">{t('emptyDesc')}</p>
                  </div>
                </td>
              </tr>
            ) : (
              users.map((user) => {
                const isSelf = user.id === currentUserId;
                return (
                  <tr key={user.id} className="hover:bg-kp-bg-hover/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-kp-accent/10 text-kp-accent font-bold text-xs">{initials(user.name)}</div>
                        <div>
                          <div className="text-xs font-semibold text-kp-text-primary">
                            {user.name}{isSelf && <span className="ml-1.5 text-[0.625rem] font-normal text-kp-text-tertiary">({t('you')})</span>}
                          </div>
                          <div className="text-[0.6875rem] text-kp-text-tertiary">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {user.scopes.length === 0 ? (
                          <span className="text-[0.6875rem] text-kp-text-tertiary">—</span>
                        ) : (
                          user.scopes.map((s) => (
                            <span key={s.userRoleId} className="inline-flex items-center gap-1 rounded-kp-sm bg-kp-bg-primary px-2 py-0.5 text-[0.6875rem] font-medium text-kp-text-secondary border border-kp-border" title={s.storeName ?? s.clientName ?? t('scopeAgency')}>
                              <ShieldCheckIcon className="h-3 w-3 text-kp-accent" />
                              {roleLabel(s.roleKey)}{s.storeName ? ` · ${s.storeName}` : s.clientName ? ` · ${s.clientName}` : ''}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {!user.allowedStores || user.allowedStores.length === 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-kp-sm bg-blue-500/10 px-2 py-0.5 text-[0.625rem] font-semibold text-blue-500 border border-blue-500/20">
                          <BuildingStorefrontIcon className="h-3 w-3" /> {t('allStores')}
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {user.allowedStores.map((s) => (
                            <span key={s.id} className="inline-flex items-center gap-1 rounded-kp-sm bg-kp-accent/10 px-2 py-0.5 text-[0.625rem] font-semibold text-kp-accent border border-kp-accent/20">
                              <BuildingStorefrontIcon className="h-3 w-3" />{s.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 text-[0.6875rem] font-medium ${user.status === 'active' ? 'text-kp-success' : 'text-kp-text-tertiary'}`}>
                        {user.status === 'active' ? (<><CheckCircleIcon className="h-3.5 w-3.5" /> {t('active')}</>) : (<><XCircleIcon className="h-3.5 w-3.5" /> {t('inactive')}</>)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        {/* Backend kendi rolunu degistirmeyi / kendini cikarmayi 400 ile reddediyor; UI'da da kapali. */}
                        <button onClick={() => onEditRole(user)} disabled={isSelf} title={isSelf ? t('selfRoleHint') : t('changeRole')} className="p-1 text-kp-text-tertiary hover:text-kp-accent transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                          <ShieldCheckIcon className="h-4 w-4" />
                        </button>
                        <button onClick={() => onEditStores(user)} title={t('editStores')} className="p-1 text-kp-text-tertiary hover:text-kp-accent transition-colors">
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button onClick={() => onRemove(user)} disabled={isSelf} title={isSelf ? t('selfRemoveHint') : t('remove')} className="p-1 text-kp-text-tertiary hover:text-kp-danger transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                          <UserMinusIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-between text-xs text-kp-text-tertiary">
          <span>{tc('total')}: {total}</span>
          <div className="flex gap-2">
            <button disabled={page <= 1} onClick={() => onPage(page - 1)} className="rounded-kp-md border border-kp-border px-3 py-1 disabled:opacity-40">{tc('actions.back')}</button>
            <span className="px-2 py-1">{page} / {pageCount}</span>
            <button disabled={page >= pageCount} onClick={() => onPage(page + 1)} className="rounded-kp-md border border-kp-border px-3 py-1 disabled:opacity-40">›</button>
          </div>
        </div>
      )}
    </div>
  );
}
