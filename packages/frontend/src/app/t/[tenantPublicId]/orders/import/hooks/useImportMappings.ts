'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { OrderImportMapping } from '../types';

export function useImportMappings() {
  const [templates, setTemplates] = useState<OrderImportMapping[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const fetchTemplates = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get<OrderImportMapping[]>('/order-import-mappings');
      if (Array.isArray(res)) {
        setTemplates(res);
      }
    } catch (err: any) {
      console.error('Şablonlar yüklenemedi:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const createTemplate = async (data: Partial<OrderImportMapping>) => {
    setIsSaving(true);
    try {
      const res = await api.post<OrderImportMapping>('/order-import-mappings', data);
      await fetchTemplates();
      return res;
    } finally {
      setIsSaving(false);
    }
  };

  const deleteTemplate = async (id: string) => {
    if (!confirm('Bu şablonu silmek istediğinize emin misiniz?')) return;
    try {
      await api.delete(`/order-import-mappings/${id}`);
      await fetchTemplates();
    } catch (err: any) {
      alert(err.message || 'Şablon silinemedi.');
    }
  };

  return {
    templates,
    isLoading,
    isSaving,
    fetchTemplates,
    createTemplate,
    deleteTemplate,
  };
}
