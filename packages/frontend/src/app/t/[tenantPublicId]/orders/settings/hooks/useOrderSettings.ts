import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '@/lib/api';
import {
  SettingSection,
  SettingDefinition,
  EffectiveSettingValue,
  SettingImpact,
} from '../types';

export function useOrderSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sections, setSections] = useState<SettingSection[]>([]);
  const [fields, setFields] = useState<SettingDefinition[]>([]);
  const [settings, setSettings] = useState<EffectiveSettingValue[]>([]);
  const [dirtyChanges, setDirtyChanges] = useState<Record<string, any>>({});
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [schemaRes, settingsRes] = await Promise.all([
        api.get<{ sections: SettingSection[]; fields: SettingDefinition[] }>('/api/order-settings/schema'),
        api.get<EffectiveSettingValue[]>('/api/order-settings'),
      ]);

      setSections(schemaRes.sections || []);
      setFields(schemaRes.fields || []);
      setSettings(settingsRes || []);
      setDirtyChanges({});
    } catch (err: any) {
      setError(err?.message || 'Ayarlar yüklenirken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const updateDraft = useCallback((key: string, value: any) => {
    setDirtyChanges((prev) => {
      // Find original effective value
      const original = settings.find((s) => s.key === key);
      if (original && JSON.stringify(original.value) === JSON.stringify(value)) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: value };
    });
  }, [settings]);

  const discardDraft = useCallback(() => {
    setDirtyChanges({});
  }, []);

  const changeList = useMemo(() => {
    return Object.entries(dirtyChanges).map(([key, value]) => ({ key, value }));
  }, [dirtyChanges]);

  const changeCount = changeList.length;
  const isDirty = changeCount > 0;

  const checkImpact = useCallback(async (): Promise<SettingImpact> => {
    if (changeList.length === 0) {
      return { summary: [], affectedOrdersCount: 0, riskLevel: 'LOW' };
    }
    return api.post<SettingImpact>('/api/order-settings/impact', {
      changes: changeList,
    });
  }, [changeList]);

  const saveChanges = useCallback(async (reason?: string) => {
    if (changeList.length === 0) return;
    setSaving(true);
    try {
      await api.patch('/api/order-settings', {
        changes: changeList,
        reason,
      });
      await fetchAll();
    } catch (err: any) {
      throw err;
    } finally {
      setSaving(false);
    }
  }, [changeList, fetchAll]);

  const resetKeys = useCallback(async (keys: string[]) => {
    setSaving(true);
    try {
      await api.post('/api/order-settings/reset', { keys });
      await fetchAll();
    } catch (err: any) {
      throw err;
    } finally {
      setSaving(false);
    }
  }, [fetchAll]);

  const lockKeys = useCallback(async (keys: string[], locked: boolean) => {
    setSaving(true);
    try {
      await api.patch('/api/order-settings/locks', { keys, locked });
      await fetchAll();
    } catch (err: any) {
      throw err;
    } finally {
      setSaving(false);
    }
  }, [fetchAll]);

  return {
    loading,
    saving,
    error,
    sections,
    fields,
    settings,
    dirtyChanges,
    isDirty,
    changeCount,
    changeList,
    updateDraft,
    discardDraft,
    checkImpact,
    saveChanges,
    resetKeys,
    lockKeys,
    refresh: fetchAll,
  };
}
