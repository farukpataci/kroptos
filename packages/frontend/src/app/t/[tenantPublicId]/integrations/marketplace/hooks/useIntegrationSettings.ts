'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';
import type {
  EffectiveSettings,
  ProviderSettingsManifest,
  SettingsValidationError,
  SettingsValidationResult,
} from '@kroptos/shared';
import { findTabIdForField, missingRequiredKeys } from '@kroptos/shared';

interface ApiValidationError extends Error {
  errors?: SettingsValidationError[];
}

/** apiFetch throws a plain Error; a 422 body carries the per-field errors. */
function extractFieldErrors(err: unknown): SettingsValidationError[] {
  const candidate = err as ApiValidationError;
  if (Array.isArray(candidate?.errors)) return candidate.errors;

  // apiFetch stringifies unknown error bodies into the message, so recover the
  // structured part when it survived that round trip.
  const message = candidate?.message ?? '';
  const start = message.indexOf('[');
  const end = message.lastIndexOf(']');
  if (start >= 0 && end > start) {
    try {
      const parsed = JSON.parse(message.slice(start, end + 1));
      if (Array.isArray(parsed)) return parsed as SettingsValidationError[];
    } catch {
      /* fall through to no field-level detail */
    }
  }
  return [];
}

export function useIntegrationSettings(integrationId: string | null) {
  const [manifest, setManifest] = useState<ProviderSettingsManifest | null>(null);
  const [snapshot, setSnapshot] = useState<EffectiveSettings | null>(null);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTabId, setActiveTabId] = useState<string>('');

  const load = useCallback(async () => {
    if (!integrationId) {
      setManifest(null);
      setSnapshot(null);
      setDraft({});
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const [schema, settings] = await Promise.all([
        apiFetch<ProviderSettingsManifest>(`/integrations/${integrationId}/settings/schema`),
        apiFetch<EffectiveSettings>(`/integrations/${integrationId}/settings`),
      ]);
      setManifest(schema);
      setSnapshot(settings);
      setDraft(settings.effective);
      setErrors({});
      setActiveTabId((current) =>
        current && schema.tabs.some((tab) => tab.id === current)
          ? current
          : (schema.tabs[0]?.id ?? ''),
      );
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load integration settings');
    } finally {
      setIsLoading(false);
    }
  }, [integrationId]);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Dirty tracking compares against the effective snapshot, not the stored
   * values: the form is populated with defaults merged in, so comparing to the
   * stored map alone would mark every default as an unsaved change.
   */
  const dirtyKeys = useMemo(() => {
    if (!snapshot) return [];
    const keys = new Set([...Object.keys(snapshot.effective), ...Object.keys(draft)]);
    return [...keys].filter(
      (key) => JSON.stringify(snapshot.effective[key]) !== JSON.stringify(draft[key]),
    );
  }, [snapshot, draft]);

  const isDirty = dirtyKeys.length > 0;

  const missingRequired = useMemo(
    () => (manifest ? missingRequiredKeys(manifest, draft) : []),
    [manifest, draft],
  );

  /** Tab ids that currently hold an unsaved change or a validation error. */
  const tabStatus = useMemo(() => {
    const status: Record<string, { dirty: boolean; error: boolean }> = {};
    if (!manifest) return status;

    const mark = (key: string, kind: 'dirty' | 'error') => {
      const tabId = findTabIdForField(manifest, key);
      if (!tabId) return;
      status[tabId] = status[tabId] ?? { dirty: false, error: false };
      status[tabId][kind] = true;
    };

    dirtyKeys.forEach((key) => mark(key, 'dirty'));
    Object.keys(errors).forEach((key) => mark(key, 'error'));
    missingRequired.forEach((key) => mark(key, 'error'));
    return status;
  }, [manifest, dirtyKeys, errors, missingRequired]);

  const setValue = useCallback((key: string, value: unknown) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!(key in prev)) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const applyFieldErrors = useCallback(
    (fieldErrors: SettingsValidationError[]) => {
      const mapped: Record<string, string> = {};
      for (const entry of fieldErrors) {
        mapped[entry.key] = entry.messageKey;
      }
      setErrors(mapped);

      // Land the user on the first tab that actually has a problem, rather than
      // showing a save failure with no visible cause.
      const firstKey = fieldErrors[0]?.key;
      if (manifest && firstKey) {
        const tabId = findTabIdForField(manifest, firstKey);
        if (tabId) setActiveTabId(tabId);
      }
    },
    [manifest],
  );

  /** Only the keys that changed are sent; defaults are the server's business. */
  const changedValues = useCallback(() => {
    const payload: Record<string, unknown> = {};
    for (const key of dirtyKeys) payload[key] = draft[key];
    return payload;
  }, [dirtyKeys, draft]);

  const submit = useCallback(
    async (method: 'PUT' | 'PATCH', values: Record<string, unknown>, note?: string) => {
      if (!integrationId) return false;
      setIsSaving(true);
      setError(null);
      try {
        const saved = await apiFetch<EffectiveSettings>(`/integrations/${integrationId}/settings`, {
          method,
          body: JSON.stringify({ values, note }),
        });
        setSnapshot(saved);
        setDraft(saved.effective);
        setErrors({});
        return true;
      } catch (err: any) {
        const fieldErrors = extractFieldErrors(err);
        if (fieldErrors.length > 0) applyFieldErrors(fieldErrors);
        else setError(err?.message ?? 'Failed to save integration settings');
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [integrationId, applyFieldErrors],
  );

  const save = useCallback(
    (note?: string) => submit('PATCH', changedValues(), note),
    [submit, changedValues],
  );

  const saveSection = useCallback(
    (sectionId: string) => {
      if (!manifest) return Promise.resolve(false);
      const section = manifest.tabs
        .flatMap((tab) => tab.sections)
        .find((candidate) => candidate.id === sectionId);
      if (!section) return Promise.resolve(false);

      const keys = new Set(section.fields.map((field) => field.key));
      const payload: Record<string, unknown> = {};
      for (const key of dirtyKeys) {
        if (keys.has(key)) payload[key] = draft[key];
      }
      return submit('PATCH', payload);
    },
    [manifest, dirtyKeys, draft, submit],
  );

  const resetSection = useCallback(
    async (sectionId?: string) => {
      if (!integrationId) return;
      setIsSaving(true);
      try {
        const reset = await apiFetch<EffectiveSettings>(
          `/integrations/${integrationId}/settings/reset`,
          { method: 'POST', body: JSON.stringify({ sectionId }) },
        );
        setSnapshot(reset);
        setDraft(reset.effective);
        setErrors({});
      } catch (err: any) {
        setError(err?.message ?? 'Failed to reset integration settings');
      } finally {
        setIsSaving(false);
      }
    },
    [integrationId],
  );

  const validate = useCallback(
    async (stepId?: string) => {
      if (!integrationId) return { valid: true, errors: [] } as SettingsValidationResult;
      const result = await apiFetch<SettingsValidationResult>(
        `/integrations/${integrationId}/settings/validate`,
        { method: 'POST', body: JSON.stringify({ values: changedValues(), stepId }) },
      );
      if (!result.valid) applyFieldErrors(result.errors);
      return result;
    },
    [integrationId, changedValues, applyFieldErrors],
  );

  const completeStep = useCallback(
    async (stepId: string) => {
      if (!integrationId) return false;
      setIsSaving(true);
      setError(null);
      try {
        const saved = await apiFetch<EffectiveSettings>(
          `/integrations/${integrationId}/settings/wizard/complete`,
          { method: 'POST', body: JSON.stringify({ stepId, values: changedValues() }) },
        );
        setSnapshot(saved);
        setDraft(saved.effective);
        setErrors({});
        return true;
      } catch (err: any) {
        const fieldErrors = extractFieldErrors(err);
        if (fieldErrors.length > 0) applyFieldErrors(fieldErrors);
        else setError(err?.message ?? 'Failed to complete this step');
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [integrationId, changedValues, applyFieldErrors],
  );

  const discard = useCallback(() => {
    if (snapshot) setDraft(snapshot.effective);
    setErrors({});
  }, [snapshot]);

  return {
    manifest,
    values: draft,
    defaults: snapshot?.defaults ?? {},
    errors,
    isLoading,
    isSaving,
    error,
    isDirty,
    dirtyKeys,
    tabStatus,
    activeTabId,
    setActiveTabId,
    setValue,
    save,
    saveSection,
    resetSection,
    validate,
    completeStep,
    discard,
    missingRequired,
    isConfigured: snapshot?.isConfigured ?? false,
    completedSteps: snapshot?.completedSteps ?? [],
    reload: load,
  };
}

export type UseIntegrationSettings = ReturnType<typeof useIntegrationSettings>;
