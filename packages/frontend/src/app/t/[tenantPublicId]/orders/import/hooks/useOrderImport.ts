'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import {
  ImportMode,
  MatchKey,
  OrderImportJob,
  FileDetectionResult,
  AutoMappingResult,
  UnmappedValuesResult,
} from '../types';

export function useOrderImport() {
  // Navigation Tabs: 'wizard' | 'history' | 'templates'
  const [activeTab, setActiveTab] = useState<'wizard' | 'history' | 'templates'>('wizard');

  // Wizard Step: 1..7
  const [step, setStep] = useState<number>(1);

  // Active Job State
  const [job, setJob] = useState<OrderImportJob | null>(null);
  const [detection, setDetection] = useState<FileDetectionResult | null>(null);
  const [mappingSuggestion, setMappingSuggestion] = useState<AutoMappingResult | null>(null);
  const [suggestedTemplateId, setSuggestedTemplateId] = useState<string | null>(null);
  const [duplicateHashWarning, setDuplicateHashWarning] = useState<string | null>(null);

  // Configuration States
  const [mode, setMode] = useState<ImportMode>('CREATE_ONLY');
  const [matchKey, setMatchKey] = useState<MatchKey>('orderNumber');
  const [columnMap, setColumnMap] = useState<Record<string, string>>({});
  const [unmappedValues, setUnmappedValues] = useState<UnmappedValuesResult | null>(null);
  const [valueMaps, setValueMaps] = useState<Record<string, Record<string, string>>>({});
  const [allowNonCatalogProducts, setAllowNonCatalogProducts] = useState(true);

  // Side-effects
  const [suppressStock, setSuppressStock] = useState(true);
  const [suppressNotifications, setSuppressNotifications] = useState(true);
  const [suppressAutomation, setSuppressAutomation] = useState(true);
  const [suppressMarketplace, setSuppressMarketplace] = useState(true);
  const [allOrNothing, setAllOrNothing] = useState(false);

  // Validation Result
  const [validationResult, setValidationResult] = useState<{
    summary: { totalOrders: number; validOrders: number; invalidOrders: number; skippedCount: number };
    sampleProblems: any[];
  } | null>(null);

  // Loading flags
  const [isUploading, setIsUploading] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Polling ref
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Poll active processing job
  const pollJobStatus = useCallback(async (jobId: string) => {
    try {
      const updated = await api.get<OrderImportJob>(`/order-imports/${jobId}`);
      if (updated) {
        setJob(updated);
        if (
          ['COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED', 'CANCELLED', 'ROLLED_BACK'].includes(
            updated.status,
          )
        ) {
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
        }
      }
    } catch (e) {
      console.error('İş durumu sorgulanamadı:', e);
    }
  }, []);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  // 1. Download Sample Template
  const downloadTemplate = async (format: 'CSV' | 'XLSX' = 'XLSX', rowMode: 'ORDER' | 'LINE_ITEM' = 'LINE_ITEM') => {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
    const stored = typeof window !== 'undefined' ? localStorage.getItem('auth') : null;
    let token = '';
    if (stored) {
      try {
        token = JSON.parse(stored).accessToken;
      } catch {}
    }

    const tenant = typeof window !== 'undefined' ? localStorage.getItem('selected_tenant') : null;
    let agencyId = '';
    let storeId = '';
    if (tenant) {
      try {
        const parsed = JSON.parse(tenant);
        agencyId = parsed.agencyId || '';
        storeId = parsed.storeId || '';
      } catch {}
    }

    const url = `${baseUrl}/order-imports/template?format=${format}&rowMode=${rowMode}`;
    fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'x-agency-id': agencyId,
        'x-store-id': storeId,
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Örnek şablon indirilemedi.');
        return res.blob();
      })
      .then((blob) => {
        const blobUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `ornek-siparis-sablonu-${rowMode.toLowerCase()}.${format.toLowerCase()}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      })
      .catch((err) => alert(err.message));
  };

  // 2. Upload File (Step 1 -> 2)
  const uploadFile = async (file: File) => {
    setIsUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
      const stored = typeof window !== 'undefined' ? localStorage.getItem('auth') : null;
      let token = '';
      if (stored) {
        try {
          token = JSON.parse(stored).accessToken;
        } catch {}
      }

      const tenant = typeof window !== 'undefined' ? localStorage.getItem('selected_tenant') : null;
      let agencyId = '';
      let storeId = '';
      if (tenant) {
        try {
          const parsed = JSON.parse(tenant);
          agencyId = parsed.agencyId || '';
          storeId = parsed.storeId || '';
        } catch {}
      }

      const res = await fetch(`${baseUrl}/order-imports/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'x-agency-id': agencyId,
          'x-store-id': storeId,
        },
        body: formData,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || 'Dosya yüklenemedi.');
      }

      const data = await res.json();
      setJob(data.job);
      setDetection(data.detection);
      setMappingSuggestion(data.mappingSuggestion);
      setSuggestedTemplateId(data.suggestedTemplateId || null);
      setDuplicateHashWarning(data.duplicateHashWarning || null);
      setColumnMap(data.mappingSuggestion?.columnMap || {});
      setMode(data.job?.mode || 'CREATE_ONLY');
      setMatchKey(data.job?.matchKey || 'orderNumber');
      setStep(2);
    } catch (err: any) {
      setUploadError(err.message || 'Dosya yüklenirken bir hata oluştu.');
    } finally {
      setIsUploading(false);
    }
  };

  // 3. Save Mapping (Step 3 -> 4 or 5)
  const saveMapping = async () => {
    if (!job) return;
    try {
      const updated = await api.patch<OrderImportJob>(`/order-imports/${job.id}/mapping`, {
        mode,
        matchKey,
        columnMap,
      });
      setJob(updated);

      // Check unmapped values
      const unmapped = await api.get<UnmappedValuesResult>(`/order-imports/${job.id}/unmapped-values`);
      setUnmappedValues(unmapped);

      // Check if there are any unmapped enum values
      const hasUnmappedEnums =
        (unmapped.status && unmapped.status.length > 0) ||
        (unmapped.paymentStatus && unmapped.paymentStatus.length > 0) ||
        (unmapped.carrierName && unmapped.carrierName.length > 0) ||
        (unmapped.products && unmapped.products.length > 0);

      if (hasUnmappedEnums) {
        setStep(4);
      } else {
        setStep(5);
      }
    } catch (err: any) {
      alert(err.message || 'Eşleştirme kaydedilemedi.');
    }
  };

  // 4. Save Value Maps (Step 4 -> 5)
  const saveValueMaps = async () => {
    if (!job) return;
    try {
      const updated = await api.patch<OrderImportJob>(`/order-imports/${job.id}/value-maps`, {
        valueMaps,
        allowNonCatalogProducts,
      });
      setJob(updated);
      setStep(5);
    } catch (err: any) {
      alert(err.message || 'Değer eşlemeleri kaydedilemedi.');
    }
  };

  // 5. Run Dry-run Validation (Step 5 -> 6)
  const runValidation = async () => {
    if (!job) return;
    setIsValidating(true);
    try {
      const res = await api.post<{
        job: OrderImportJob;
        summary: any;
        sampleProblems: any[];
      }>(`/order-imports/${job.id}/validate`, {});

      setJob(res.job);
      setValidationResult({
        summary: res.summary,
        sampleProblems: res.sampleProblems || [],
      });
      setStep(6);
    } catch (err: any) {
      alert(err.message || 'Ön kontrol çalıştırılamadı.');
    } finally {
      setIsValidating(false);
    }
  };

  // 6. Start Processing (Step 6 -> 7)
  const startImport = async () => {
    if (!job) return;
    setIsStarting(true);
    try {
      const updated = await api.post<OrderImportJob>(`/order-imports/${job.id}/start`, {
        suppressStock,
        suppressNotifications,
        suppressAutomation,
        suppressMarketplace,
        allOrNothing,
      });
      setJob(updated);
      setStep(7);

      // Start polling progress
      if (pollingRef.current) clearInterval(pollingRef.current);
      pollingRef.current = setInterval(() => {
        pollJobStatus(job.id);
      }, 2000);
    } catch (err: any) {
      alert(err.message || 'İçe aktarma başlatılamadı.');
    } finally {
      setIsStarting(false);
    }
  };

  // 7. Reset Wizard
  const resetWizard = () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    setJob(null);
    setDetection(null);
    setMappingSuggestion(null);
    setDuplicateHashWarning(null);
    setColumnMap({});
    setValueMaps({});
    setValidationResult(null);
    setStep(1);
  };

  return {
    activeTab,
    setActiveTab,
    step,
    setStep,
    job,
    detection,
    mappingSuggestion,
    suggestedTemplateId,
    duplicateHashWarning,
    mode,
    setMode,
    matchKey,
    setMatchKey,
    columnMap,
    setColumnMap,
    unmappedValues,
    valueMaps,
    setValueMaps,
    allowNonCatalogProducts,
    setAllowNonCatalogProducts,
    suppressStock,
    setSuppressStock,
    suppressNotifications,
    setSuppressNotifications,
    suppressAutomation,
    setSuppressAutomation,
    suppressMarketplace,
    setSuppressMarketplace,
    allOrNothing,
    setAllOrNothing,
    validationResult,
    isUploading,
    isValidating,
    isStarting,
    uploadError,
    downloadTemplate,
    uploadFile,
    saveMapping,
    saveValueMaps,
    runValidation,
    startImport,
    resetWizard,
  };
}
