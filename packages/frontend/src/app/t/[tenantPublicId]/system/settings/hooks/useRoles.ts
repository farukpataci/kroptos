'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

export interface RoleRow {
  id: string;
  agencyId: string | null;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  userCount: number;
  permissions: string[];
}

export interface PermissionGroup {
  category: string;
  permissions: { key: string; name: string; description: string; unusedYet: boolean }[];
}

/** Rol CRUD + izin matrisi. Katalog backend'den (shared'in aynisi), gruplu. */
export function useRoles() {
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [catalog, setCatalog] = useState<PermissionGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [r, c] = await Promise.all([
        apiFetch<RoleRow[]>('/api/system/roles'),
        apiFetch<PermissionGroup[]>('/api/system/permissions'),
      ]);
      setRoles(r);
      setCatalog(c);
    } catch (err: any) {
      setError(err?.message || 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const createRole = async (payload: { name: string; description?: string; permissions: string[] }) => {
    const created = await apiFetch<RoleRow>('/api/system/roles', { method: 'POST', body: JSON.stringify(payload) });
    await fetchAll();
    return created;
  };

  const updateRole = async (id: string, payload: { name?: string; description?: string; permissions?: string[] }) => {
    const updated = await apiFetch<RoleRow>(`/api/system/roles/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
    await fetchAll();
    return updated;
  };

  const deleteRole = async (id: string) => {
    await apiFetch(`/api/system/roles/${id}`, { method: 'DELETE' });
    await fetchAll();
  };

  return { roles, catalog, isLoading, error, refresh: fetchAll, createRole, updateRole, deleteRole };
}
