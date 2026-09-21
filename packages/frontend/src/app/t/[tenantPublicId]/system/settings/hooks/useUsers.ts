'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

export interface UserScope {
  userRoleId: string;
  roleId: string;
  roleKey: string;
  roleName: string;
  clientId: string | null;
  clientName: string | null;
  storeId: string | null;
  storeName: string | null;
}

export interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string | null;
  roleId?: string;
  status: 'active' | 'inactive';
  createdAt: string;
  scopes: UserScope[];
  allowedStoreIds: string[];
  allowedStores: { id: string; name: string; publicId: string }[];
}

export interface AvailableStore {
  id: string;
  name: string;
  publicId: string;
}

export interface UserFilters {
  search: string;
  role: string;
  status: '' | 'active' | 'inactive';
}

interface ListResponse {
  total: number;
  page: number;
  limit: number;
  users: UserRow[];
  availableStores: AvailableStore[];
}

const LIMIT = 25;

/** Liste + filtre + sayfalama + mutasyonlar; sunum UsersTable'da. */
export function useUsers() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [availableStores, setAvailableStores] = useState<AvailableStore[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<UserFilters>({ search: '', role: '', status: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
      if (filters.search) params.set('search', filters.search);
      if (filters.role) params.set('role', filters.role);
      if (filters.status) params.set('status', filters.status);
      const data = await apiFetch<ListResponse>(`/api/system/users?${params.toString()}`);
      setUsers(data.users ?? []);
      setAvailableStores(data.availableStores ?? []);
      setTotal(data.total ?? 0);
    } catch (err: any) {
      setError(err?.message || 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const updateFilters = (patch: Partial<UserFilters>) => {
    setPage(1);
    setFilters((prev) => ({ ...prev, ...patch }));
  };

  const updateUser = async (id: string, payload: { isActive?: boolean; firstName?: string; lastName?: string; phone?: string }) => {
    await apiFetch(`/api/system/users/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
    await fetchUsers();
  };

  const changeRole = async (id: string, payload: { roleId: string; clientId?: string; storeId?: string }) => {
    await apiFetch(`/api/system/users/${id}/role`, { method: 'PATCH', body: JSON.stringify(payload) });
    await fetchUsers();
  };

  const removeUser = async (id: string) => {
    await apiFetch(`/api/system/users/${id}`, { method: 'DELETE' });
    await fetchUsers();
  };

  const updateStores = async (id: string, storeIds: string[]) => {
    await apiFetch(`/api/system/users/${id}/stores`, { method: 'PATCH', body: JSON.stringify({ storeIds }) });
    await fetchUsers();
  };

  return {
    users,
    availableStores,
    total,
    page,
    setPage,
    pageCount: Math.max(1, Math.ceil(total / LIMIT)),
    filters,
    updateFilters,
    isLoading,
    error,
    refresh: fetchUsers,
    updateUser,
    changeRole,
    removeUser,
    updateStores,
  };
}
