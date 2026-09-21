'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export type Channel = 'EMAIL' | 'SMS';
export type ScopeLevel = 'SYSTEM' | 'AGENCY' | 'CLIENT' | 'STORE';

export interface TemplateRow {
  id: string;
  channel: Channel;
  event: string;
  orderStatusKey: string;
  locale: string;
  name: string;
  subject: string | null;
  isActive: boolean;
  isSystemDefault: boolean;
  resolvedFrom: ScopeLevel;
  scopeLevel: ScopeLevel;
  sendDelayMinutes: number;
  version: number;
  updatedAt: string | null;
  editable: boolean;
}

export interface TemplateDetail extends TemplateRow {
  bodyHtml: string | null;
  bodyText: string;
  senderName?: string | null;
  replyTo?: string | null;
  smsSenderId?: string | null;
}

export interface TemplateIssue {
  field: string;
  line: number;
  message: string;
  variable?: string;
}

export interface VariableDef {
  path: string;
  label: string;
  sample: unknown;
}

export interface PreviewResult {
  issues: TemplateIssue[];
  subject: string;
  html: string;
  text: string;
  sms: { charCount: number; segments: number; encoding: 'GSM-7' | 'UCS-2' } | null;
  sample: boolean;
}

export interface TemplateVersion {
  id: string;
  version: number;
  snapshot: Record<string, any>;
  createdAt: string;
  createdById: string | null;
}

export interface TemplateFilters {
  channel: '' | Channel;
  locale: string;
  search: string;
}

const BASE = '/api/notification-templates';

/** Şablon listesi + tek şablon işlemleri. Bağlam (ajans/marka/mağaza) apiFetch başlıklarından gider. */
export function useNotificationTemplates() {
  const { tenantContext } = useAuth();
  const [items, setItems] = useState<TemplateRow[]>([]);
  const [level, setLevel] = useState<ScopeLevel>('AGENCY');
  const [locales, setLocales] = useState<string[]>(['tr', 'en']);
  const [filters, setFilters] = useState<TemplateFilters>({ channel: '', locale: 'tr', search: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(0);

  const refresh = useCallback(async () => {
    const ticket = ++latest.current;
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters.channel) params.set('channel', filters.channel);
      if (filters.locale) params.set('locale', filters.locale);
      if (filters.search) params.set('search', filters.search);
      const data = await apiFetch<{ items: TemplateRow[]; level: ScopeLevel; locales: string[] }>(`${BASE}?${params}`);
      if (ticket !== latest.current) return;
      setItems(data.items);
      setLevel(data.level);
      setLocales(data.locales);
    } catch (e: any) {
      if (ticket !== latest.current) return;
      setError(e?.message || 'Failed to load');
      setItems([]);
    } finally {
      if (ticket === latest.current) setIsLoading(false);
    }
  }, [filters.channel, filters.locale, filters.search]);

  // Üst bardaki marka/mağaza seçimi değişince kapsam değişir → yeniden yükle.
  useEffect(() => {
    refresh();
  }, [refresh, tenantContext.agencyId, tenantContext.clientId, tenantContext.storeId]);

  const get = (id: string) => apiFetch<TemplateDetail>(`${BASE}/${id}`);
  const customize = (id: string) => apiFetch<TemplateDetail>(`${BASE}/${id}/customize`, { method: 'POST' });
  const update = (id: string, payload: Partial<TemplateDetail>) => apiFetch<TemplateDetail>(`${BASE}/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
  const toggle = (id: string) => apiFetch<TemplateDetail>(`${BASE}/${id}/toggle`, { method: 'PATCH' });
  const remove = (id: string) => apiFetch<void>(`${BASE}/${id}`, { method: 'DELETE' });
  const versions = (id: string) => apiFetch<TemplateVersion[]>(`${BASE}/${id}/versions`);
  const restore = (id: string, versionId: string) => apiFetch<TemplateDetail>(`${BASE}/${id}/versions/${versionId}/restore`, { method: 'POST' });
  const variables = (event: string) => apiFetch<VariableDef[]>(`${BASE}/variables?event=${encodeURIComponent(event)}`);
  const preview = (payload: { channel: Channel; event: string; subject?: string; bodyHtml?: string; bodyText?: string; orderId?: string }, signal?: AbortSignal) =>
    apiFetch<PreviewResult>(`${BASE}/preview`, { method: 'POST', body: JSON.stringify(payload), signal });
  const testSend = (id: string, payload: { recipient: string; orderId?: string; subject?: string; bodyHtml?: string; bodyText?: string }) =>
    apiFetch<{ logId: string }>(`${BASE}/${id}/test-send`, { method: 'POST', body: JSON.stringify(payload) });

  return { items, level, locales, filters, setFilters, isLoading, error, refresh, get, customize, update, toggle, remove, versions, restore, variables, preview, testSend };
}
