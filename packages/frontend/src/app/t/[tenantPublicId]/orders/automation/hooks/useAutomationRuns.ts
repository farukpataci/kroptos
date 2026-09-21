'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { AutomationRun } from '../types';

export interface RunFilters {
  ruleId?: string;
  orderId?: string;
  status?: string;
  includeSkipped?: boolean;
}

export function useAutomationRuns() {
  const { tenantContext } = useAuth();
  const activeStoreId = tenantContext?.storeId ?? null;

  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [filters, setFilters] = useState<RunFilters>({
    includeSkipped: false,
  });

  const fetchRuns = useCallback(async () => {
    if (!activeStoreId) {
      setRuns([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const params: Record<string, any> = {
        page,
        limit,
      };

      if (filters.ruleId) params.ruleId = filters.ruleId;
      if (filters.orderId) params.orderId = filters.orderId;
      if (filters.status && filters.status !== 'ALL') params.status = filters.status;
      if (filters.includeSkipped) params.includeSkipped = 'true';

      const response = await api.get<{
        items: AutomationRun[];
        meta?: {
          total: number;
          page: number;
          limit: number;
          totalPages: number;
        };
        total?: number;
        totalPages?: number;
      }>('/automation-rules/runs', { params });

      setRuns(response.items || []);
      setTotal(response.meta?.total ?? response.total ?? 0);
      setTotalPages(response.meta?.totalPages ?? response.totalPages ?? 1);
    } catch (err: any) {
      setError(err?.message || 'Çalışma günlüğü yüklenemedi.');
    } finally {
      setIsLoading(false);
    }
  }, [activeStoreId, page, limit, filters]);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  const retryRun = useCallback(
    async (runId: string) => {
      const retried = await api.post<AutomationRun>(`/automation-rules/runs/${runId}/retry`);
      await fetchRuns();
      return retried;
    },
    [fetchRuns],
  );

  return {
    runs,
    total,
    page,
    limit,
    totalPages,
    isLoading,
    error,
    filters,
    setFilters,
    setPage,
    reload: fetchRuns,
    retryRun,
  };
}
