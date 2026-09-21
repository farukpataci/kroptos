'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import type { Channel } from './useNotificationTemplates';

export type LogStatus = 'QUEUED' | 'SENT' | 'DELIVERED' | 'FAILED' | 'SKIPPED';

export interface LogRow {
  id: string;
  channel: Channel;
  event: string;
  orderId: string | null;
  recipient: string;
  subject: string | null;
  renderedBody: string;
  status: LogStatus;
  provider: string;
  providerMessageId: string | null;
  errorMessage: string | null;
  attempts: number;
  sentAt: string | null;
  isTest: boolean;
  createdAt: string;
  template: { id: string; name: string; scopeLevel: string } | null;
}

export interface LogFilters {
  channel: '' | Channel;
  status: '' | LogStatus;
  event: string;
  orderId: string;
  from: string;
  to: string;
}

const BASE = '/api/notification-logs';

export function useNotificationLogs() {
  const { tenantContext } = useAuth();
  const [items, setItems] = useState<LogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [filters, setFilters] = useState<LogFilters>({ channel: '', status: '', event: '', orderId: '', from: '', to: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(0);

  const refresh = useCallback(async () => {
    const ticket = ++latest.current;
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '25' });
      for (const [k, v] of Object.entries(filters)) {
        if (!v) continue;
        params.set(k, k === 'from' ? new Date(v).toISOString() : k === 'to' ? new Date(v + 'T23:59:59').toISOString() : v);
      }
      const data = await apiFetch<{ items: LogRow[]; total: number; pageCount: number }>(`${BASE}?${params}`);
      if (ticket !== latest.current) return;
      setItems(data.items);
      setTotal(data.total);
      setPageCount(data.pageCount);
    } catch (e: any) {
      if (ticket !== latest.current) return;
      setError(e?.message || 'Failed to load');
      setItems([]);
    } finally {
      if (ticket === latest.current) setIsLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    refresh();
  }, [refresh, tenantContext.agencyId, tenantContext.clientId, tenantContext.storeId]);

  const updateFilters = (patch: Partial<LogFilters>) => {
    setPage(1);
    setFilters((f) => ({ ...f, ...patch }));
  };
  const retry = (id: string) => apiFetch<{ ok: boolean }>(`${BASE}/${id}/retry`, { method: 'POST' });

  return { items, total, page, pageCount, setPage, filters, updateFilters, isLoading, error, refresh, retry };
}
