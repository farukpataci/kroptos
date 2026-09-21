'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import {
  ExportColumnDef,
  ExportFormat,
  FormatOptions,
  OrderExportFilters,
  OrderExportJob,
  OrderExportPreset,
  RowMode,
  ExportCountResult,
  ExportPreviewResult,
} from '../types';

export function useOrderExport() {
  const [activeTab, setActiveTab] = useState<'new' | 'history' | 'schedules'>('new');

  // Preset
  const [presets, setPresets] = useState<OrderExportPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
  const [isLoadingPresets, setIsLoadingPresets] = useState(false);

  // Configuration
  const [rowMode, setRowMode] = useState<RowMode>('ORDER');
  const [format, setFormat] = useState<ExportFormat>('XLSX');
  const [formatOptions, setFormatOptions] = useState<FormatOptions>({
    delimiter: ';',
    includeBom: true,
    timezone: 'Europe/Istanbul',
    dateFormat: 'YYYY-MM-DD HH:mm',
    headerLanguage: 'tr',
  });

  // Filters
  const [filters, setFilters] = useState<OrderExportFilters>({
    dateField: 'createdAt',
  });

  // Columns
  const [availableColumns, setAvailableColumns] = useState<ExportColumnDef[]>([]);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([
    'orderNumber',
    'createdAt',
    'customerName',
    'customerPhone',
    'shippingCity',
    'totalAmount',
    'currency',
    'status',
    'paymentStatus',
    'fulfillmentStatus',
  ]);
  const [isLoadingColumns, setIsLoadingColumns] = useState(false);

  // Live Count
  const [count, setCount] = useState<ExportCountResult | null>(null);
  const [isCounting, setIsCounting] = useState(false);
  const countTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Preview
  const [preview, setPreview] = useState<ExportPreviewResult | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Active Job (In Progress)
  const [activeJob, setActiveJob] = useState<OrderExportJob | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Fetch Columns
  const fetchColumns = useCallback(async (mode: RowMode) => {
    setIsLoadingColumns(true);
    try {
      const res = await api.get<{ columns: ExportColumnDef[] }>(
        `/v1/orders/export/columns?rowMode=${mode}`,
      );
      if (res?.columns) {
        setAvailableColumns(res.columns);
      }
    } catch (err: any) {
      console.error('Kolonlar yüklenemedi:', err);
    } finally {
      setIsLoadingColumns(false);
    }
  }, []);

  useEffect(() => {
    fetchColumns(rowMode);
  }, [fetchColumns, rowMode]);

  // 2. Fetch Presets
  const fetchPresets = useCallback(async () => {
    setIsLoadingPresets(true);
    try {
      const res = await api.get<OrderExportPreset[]>('/v1/orders/export/presets');
      if (Array.isArray(res)) {
        setPresets(res);
      }
    } catch (err: any) {
      console.error('Şablonlar yüklenemedi:', err);
    } finally {
      setIsLoadingPresets(false);
    }
  }, []);

  useEffect(() => {
    fetchPresets();
  }, [fetchPresets]);

  // 3. Count (Debounced)
  const fetchCount = useCallback(async (currentFilters: OrderExportFilters) => {
    setIsCounting(true);
    try {
      const res = await api.post<ExportCountResult>('/v1/orders/export/count', currentFilters);
      setCount(res);
    } catch (err: any) {
      console.error('Sayaç yüklenemedi:', err);
    } finally {
      setIsCounting(false);
    }
  }, []);

  useEffect(() => {
    if (countTimerRef.current) clearTimeout(countTimerRef.current);
    countTimerRef.current = setTimeout(() => {
      fetchCount(filters);
    }, 400);

    return () => {
      if (countTimerRef.current) clearTimeout(countTimerRef.current);
    };
  }, [filters, fetchCount]);

  // 4. Fetch Preview
  const fetchPreview = useCallback(async () => {
    if (selectedColumns.length === 0) return;
    setIsLoadingPreview(true);
    setPreviewError(null);
    try {
      const res = await api.post<ExportPreviewResult>('/v1/orders/export/preview', {
        columns: selectedColumns,
        filters,
        rowMode,
        formatOptions,
      });
      setPreview(res);
    } catch (err: any) {
      setPreviewError(err?.message || 'Önizleme yüklenemedi');
    } finally {
      setIsLoadingPreview(false);
    }
  }, [selectedColumns, filters, rowMode, formatOptions]);

  // Apply Preset
  const applyPreset = useCallback(
    (presetId: string) => {
      setSelectedPresetId(presetId);
      if (!presetId) return;

      const preset = presets.find((p) => p.id === presetId);
      if (!preset) return;

      setRowMode(preset.rowMode);
      setFormat(preset.format);
      if (preset.columns && Array.isArray(preset.columns)) {
        setSelectedColumns(preset.columns);
      }
      if (preset.filters) {
        setFilters((prev) => ({ ...prev, ...preset.filters }));
      }
      if (preset.formatOptions) {
        setFormatOptions((prev) => ({ ...prev, ...preset.formatOptions }));
      }
    },
    [presets],
  );

  // Poll Active Job
  const pollJob = useCallback(async (jobId: string) => {
    try {
      const job = await api.get<OrderExportJob>(`/v1/orders/export/jobs/${jobId}`);
      setActiveJob(job);

      if (job.status === 'COMPLETED' || job.status === 'FAILED' || job.status === 'CANCELLED') {
        setIsExporting(false);
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      }
    } catch (err: any) {
      console.error('İş durumu sorgulama hatası:', err);
    }
  }, []);

  // 5. Trigger Export
  const startExport = async () => {
    if (selectedColumns.length === 0) {
      setExportError('En az bir kolon seçilmelidir.');
      return;
    }

    setIsExporting(true);
    setExportError(null);
    setActiveJob(null);

    try {
      const job = await api.post<OrderExportJob>('/v1/orders/export/jobs', {
        presetId: selectedPresetId || undefined,
        rowMode,
        format,
        columns: selectedColumns,
        filters,
        formatOptions,
      });

      setActiveJob(job);

      // Start 2s polling
      if (pollingRef.current) clearInterval(pollingRef.current);
      pollingRef.current = setInterval(() => {
        pollJob(job.id);
      }, 2000);
    } catch (err: any) {
      setExportError(err?.message || 'Dışa aktarma başlatılamadı');
      setIsExporting(false);
    }
  };

  // Download Trigger
  const downloadActiveJob = async () => {
    if (!activeJob || activeJob.status !== 'COMPLETED') return;
    try {
      const res = await api.post<{ token: string }>(
        `/v1/orders/export/jobs/${activeJob.id}/download-token`,
        {},
      );
      if (res?.token) {
        const downloadUrl = `/api/v1/orders/export/download/${activeJob.id}?token=${res.token}`;
        window.location.href = downloadUrl;
      }
    } catch (err: any) {
      console.error('İndirme başlatılamadı:', err);
    }
  };

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  return {
    activeTab,
    setActiveTab,
    presets,
    selectedPresetId,
    applyPreset,
    isLoadingPresets,
    fetchPresets,
    rowMode,
    setRowMode,
    format,
    setFormat,
    formatOptions,
    setFormatOptions,
    filters,
    setFilters,
    availableColumns,
    selectedColumns,
    setSelectedColumns,
    isLoadingColumns,
    count,
    isCounting,
    preview,
    isLoadingPreview,
    previewError,
    fetchPreview,
    activeJob,
    isExporting,
    exportError,
    startExport,
    downloadActiveJob,
  };
}
