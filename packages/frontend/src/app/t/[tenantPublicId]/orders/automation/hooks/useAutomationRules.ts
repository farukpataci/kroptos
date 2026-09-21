'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  AutomationCatalog,
  AutomationRule,
  BacktestResult,
  DryRunResult,
} from '../types';

export function useAutomationRules() {
  const t = useTranslations('orderAutomation');
  const tc = useTranslations('common');
  const { tenantContext } = useAuth();

  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [catalog, setCatalog] = useState<AutomationCatalog | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const activeStoreId = tenantContext?.storeId ?? null;
  const hasStore = !!activeStoreId;
  const lastStoreRef = useRef<string | null>(null);

  const fetchCatalog = useCallback(async () => {
    try {
      const data = await api.get<AutomationCatalog>('/automation-rules/catalog');
      setCatalog(data);
    } catch (err: any) {
      console.error('[useAutomationRules] Failed to fetch catalog:', err);
    }
  }, []);

  const fetchRules = useCallback(async () => {
    if (!hasStore) {
      setRules([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const data = await api.get<AutomationRule[]>('/automation-rules');
      setRules(data);
    } catch (err: any) {
      setError(err?.message || t('loadFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [hasStore, t]);

  useEffect(() => {
    fetchCatalog();
  }, [fetchCatalog]);

  useEffect(() => {
    if (activeStoreId !== lastStoreRef.current) {
      lastStoreRef.current = activeStoreId;
      fetchRules();
    }
  }, [activeStoreId, fetchRules]);

  const createRule = useCallback(
    async (payload: any) => {
      const created = await api.post<AutomationRule>('/automation-rules', payload);
      await fetchRules();
      return created;
    },
    [fetchRules],
  );

  const updateRule = useCallback(
    async (id: string, payload: any) => {
      const updated = await api.put<AutomationRule>(`/automation-rules/${id}`, payload);
      await fetchRules();
      return updated;
    },
    [fetchRules],
  );

  const toggleRule = useCallback(
    async (id: string, isActive: boolean) => {
      // Optimistic update
      setRules((prev) =>
        prev.map((r) => (r.id === id ? { ...r, isActive } : r)),
      );
      try {
        const updated = await api.patch<AutomationRule>(`/automation-rules/${id}/toggle`, {
          isActive,
        });
        setRules((prev) =>
          prev.map((r) => (r.id === id ? { ...r, isActive: updated.isActive } : r)),
        );
        return updated;
      } catch (err) {
        // Rollback
        setRules((prev) =>
          prev.map((r) => (r.id === id ? { ...r, isActive: !isActive } : r)),
        );
        throw err;
      }
    },
    [],
  );

  const reorderRules = useCallback(
    async (ruleIds: string[]) => {
      try {
        await api.patch('/automation-rules/reorder', { ruleIds });
        await fetchRules();
      } catch (err) {
        await fetchRules();
        throw err;
      }
    },
    [fetchRules],
  );

  const duplicateRule = useCallback(
    async (id: string) => {
      const dup = await api.post<AutomationRule>(`/automation-rules/${id}/duplicate`);
      await fetchRules();
      return dup;
    },
    [fetchRules],
  );

  const deleteRule = useCallback(
    async (id: string) => {
      await api.delete(`/automation-rules/${id}`);
      setRules((prev) => prev.filter((r) => r.id !== id));
    },
    [],
  );

  const dryRunTest = useCallback(
    async (payload: { orderId: string; ruleId?: string; rule?: any }): Promise<DryRunResult> => {
      return api.post<DryRunResult>('/automation-rules/test', payload);
    },
    [],
  );

  const backtest = useCallback(
    async (id: string, days = 30): Promise<BacktestResult> => {
      return api.post<BacktestResult>(`/automation-rules/${id}/backtest`, { days });
    },
    [],
  );

  const runRuleManually = useCallback(
    async (id: string, orderIds?: string[]) => {
      return api.post<{ applied: number; skipped: number; failed: number }>(
        `/automation-rules/${id}/run`,
        { orderIds },
      );
    },
    [],
  );

  const restoreVersion = useCallback(
    async (id: string, version: number) => {
      const restored = await api.post<AutomationRule>(
        `/automation-rules/${id}/versions/${version}/restore`,
      );
      await fetchRules();
      return restored;
    },
    [fetchRules],
  );

  return {
    rules,
    catalog,
    isLoading,
    error,
    hasStore,
    reload: fetchRules,
    createRule,
    updateRule,
    toggleRule,
    reorderRules,
    duplicateRule,
    deleteRule,
    dryRunTest,
    backtest,
    runRuleManually,
    restoreVersion,
  };
}
