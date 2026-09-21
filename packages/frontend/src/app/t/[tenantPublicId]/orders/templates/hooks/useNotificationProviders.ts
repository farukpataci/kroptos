'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import type { Channel } from './useNotificationTemplates';

export interface ProviderField {
  key: string;
  label: string;
  secret?: boolean;
  type?: 'text' | 'number' | 'boolean';
}

export interface ProviderConfig {
  channel: Channel;
  provider: string | null;
  isActive: boolean;
  config: Record<string, unknown>;
  secretsSet: string[];
  options: string[];
  fields: Record<string, ProviderField[]>;
  updatedAt: string | null;
}

const BASE = '/api/notification-providers';

export function useNotificationProviders(enabled: boolean) {
  const { tenantContext } = useAuth();
  const [items, setItems] = useState<ProviderConfig[]>([]);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    setIsLoading(true);
    setError(null);
    try {
      setItems(await apiFetch<ProviderConfig[]>(BASE));
    } catch (e: any) {
      setError(e?.message || 'Failed to load');
    } finally {
      setIsLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    refresh();
  }, [refresh, tenantContext.agencyId]);

  const save = (payload: { channel: Channel; provider: string; isActive?: boolean; config?: Record<string, unknown>; secrets?: Record<string, string> }) =>
    apiFetch<ProviderConfig>(BASE, { method: 'PATCH', body: JSON.stringify(payload) });
  const test = (channel: Channel) => apiFetch<{ ok: boolean; provider: string }>(`${BASE}/test`, { method: 'POST', body: JSON.stringify({ channel }) });

  return { items, isLoading, error, refresh, save, test };
}
