'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export interface AutomationConditions {
  source?: string[];
  statusIn?: string[];
  paymentStatusIn?: string[];
  fulfillmentStatusIn?: string[];
  minTotal?: number;
  maxTotal?: number;
  currency?: string;
  cities?: string[];
  isPoolOrder?: boolean;
  olderThanMinutes?: number;
}

export interface AutomationAction {
  type: string;
  value?: string;
  note?: string;
}

export interface AutomationRule {
  id: string;
  name: string;
  description?: string | null;
  trigger: string;
  priority: number;
  conditions: AutomationConditions;
  action: AutomationAction;
  isActive: boolean;
  effectiveFrom: string;
  lastRunAt?: string | null;
  matchCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationRun {
  id: string;
  ruleId: string;
  orderId: string;
  status: 'applied' | 'skipped' | 'failed';
  message?: string | null;
  appliedAction?: AutomationAction | null;
  createdAt: string;
}

/** Formun beslendiği listeler; sunucudan gelir, istemciye gömülmez. */
export interface AutomationMeta {
  triggers: string[];
  actions: string[];
  orderStatuses: string[];
  paymentStatuses: string[];
  fulfillmentStatuses: string[];
}

export interface PreviewResult {
  matched: number;
  scanned: number;
  samples: Array<{
    id: string;
    orderNumber: string;
    customerName: string;
    status: string;
    paymentStatus: string;
    totalAmount: string;
    currency: string;
    createdAt: string;
  }>;
}

export interface RunResult {
  applied: number;
  skipped: number;
  failed: number;
  scanned: number;
}

export interface RulePayload {
  name: string;
  description?: string;
  trigger: string;
  priority?: number;
  conditions: AutomationConditions;
  action: AutomationAction;
  isActive?: boolean;
}

const BASE = '/order-automation';

export function useOrderAutomation() {
  const t = useTranslations('orderAutomation');
  const { tenantContext } = useAuth();

  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [meta, setMeta] = useState<AutomationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** Uçuştaki istek, yenisi geldiğinde iptal edilebilsin diye. */
  const inFlight = useRef<AbortController | null>(null);
  /** Artan bilet: yalnız en yeni istek state'e yazabilir. */
  const latestRequest = useRef(0);

  const hasStore = Boolean(tenantContext.storeId);

  const load = useCallback(async () => {
    if (!hasStore) {
      setIsLoading(false);
      return;
    }

    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    const ticket = ++latestRequest.current;

    setIsLoading(true);
    setError(null);
    try {
      const [ruleList, runList] = await Promise.all([
        api.get<AutomationRule[]>(BASE, { signal: controller.signal }),
        api.get<AutomationRun[]>(`${BASE}/runs`, {
          params: { limit: 50 },
          signal: controller.signal,
        }),
      ]);
      if (ticket !== latestRequest.current) return;
      setRules(ruleList || []);
      setRuns(runList || []);
    } catch (e: any) {
      // İptal edilen istek hata değil, önceki tuş vuruşudur.
      if (e?.name === 'AbortError' || ticket !== latestRequest.current) return;
      // Gösteriliyor, yutulmuyor: buradaki 403 rolün orders.automation.read
      // iznine sahip olmadığı anlamına gelir ve boş tablo bunu "kural yok"
      // diye okuturdu.
      setError(e?.message || t('loadFailed'));
      setRules([]);
      setRuns([]);
    } finally {
      if (ticket === latestRequest.current) setIsLoading(false);
    }
  }, [hasStore, t]);

  // Sözlük bir kez okunur; kural listesiyle birlikte her yenilemede
  // çekilmesi aynı sabit listeyi tekrar tekrar indirmek olurdu.
  const loadMeta = useCallback(async () => {
    if (!hasStore) return;
    try {
      setMeta(await api.get<AutomationMeta>(`${BASE}/meta`));
    } catch {
      // Sözlük gelmezse form açılmaz; liste yine de görünür.
    }
  }, [hasStore]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadMeta();
  }, [loadMeta]);

  const createRule = useCallback(
    async (payload: RulePayload) => {
      const created = await api.post<AutomationRule>(BASE, payload);
      setRules((prev) => [created, ...prev]);
      return created;
    },
    [],
  );

  const updateRule = useCallback(async (id: string, payload: Partial<RulePayload>) => {
    const updated = await api.patch<AutomationRule>(`${BASE}/${id}`, payload);
    setRules((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    return updated;
  }, []);

  const toggleRule = useCallback(
    (rule: AutomationRule) => updateRule(rule.id, { isActive: !rule.isActive }),
    [updateRule],
  );

  const deleteRule = useCallback(async (id: string) => {
    await api.delete(`${BASE}/${id}`);
    setRules((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const previewRule = useCallback(
    (id: string) => api.post<PreviewResult>(`${BASE}/${id}/preview`),
    [],
  );

  const runRule = useCallback(
    async (id: string) => {
      const result = await api.post<RunResult>(`${BASE}/${id}/run`);
      // Çalışma sonrası liste ve geçmiş değişti; sunucudan yeniden okunur.
      await load();
      return result;
    },
    [load],
  );

  return {
    rules,
    runs,
    meta,
    isLoading,
    error,
    hasStore,
    reload: load,
    createRule,
    updateRule,
    toggleRule,
    deleteRule,
    previewRule,
    runRule,
  };
}
