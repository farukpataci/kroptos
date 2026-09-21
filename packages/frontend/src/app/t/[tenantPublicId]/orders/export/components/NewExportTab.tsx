'use client';

import { useState } from 'react';
import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  BookmarkSquareIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  EyeIcon,
  LockClosedIcon,
  MagnifyingGlassIcon,
  SparklesIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useOrderExport } from '../hooks/useOrderExport';
import { ExportColumnDef, RowMode } from '../types';
import { PresetModal } from './PresetModal';

const GROUP_LABELS: Record<string, string> = {
  ORDER: 'Sipariş Bilgileri',
  CUSTOMER: 'Müşteri & Alıcı (PII)',
  ITEM: 'Ürün & Kalem',
  PAYMENT: 'Ödeme',
  SHIPPING: 'Kargo & Adres',
  FINANCIAL: 'Mali & Vergi',
  METADATA: 'Meta Veriler & Sistem',
};

export function NewExportTab({
  exportHook,
}: {
  exportHook: ReturnType<typeof useOrderExport>;
}) {
  const {
    presets,
    selectedPresetId,
    applyPreset,
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
    fetchPresets,
  } = exportHook;

  const [columnSearch, setColumnSearch] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isPresetModalOpen, setIsPresetModalOpen] = useState(false);

  // Quick date ranges
  const applyQuickDate = (type: string) => {
    const now = new Date();
    switch (type) {
      case 'TODAY': {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
        setFilters((prev) => ({ ...prev, startDate: start.toISOString(), endDate: end.toISOString() }));
        break;
      }
      case 'YESTERDAY': {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0);
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59);
        setFilters((prev) => ({ ...prev, startDate: start.toISOString(), endDate: end.toISOString() }));
        break;
      }
      case 'LAST_7_DAYS': {
        const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        setFilters((prev) => ({ ...prev, startDate: start.toISOString(), endDate: now.toISOString() }));
        break;
      }
      case 'THIS_MONTH': {
        const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
        setFilters((prev) => ({ ...prev, startDate: start.toISOString(), endDate: now.toISOString() }));
        break;
      }
      case 'LAST_MONTH': {
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0);
        const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        setFilters((prev) => ({ ...prev, startDate: start.toISOString(), endDate: end.toISOString() }));
        break;
      }
      case 'ALL':
      default:
        setFilters((prev) => ({ ...prev, startDate: undefined, endDate: undefined }));
        break;
    }
  };

  // Filter available columns by search & row mode
  const filteredAvailableColumns = availableColumns.filter((col) => {
    const matchesSearch =
      col.label.toLowerCase().includes(columnSearch.toLowerCase()) ||
      col.key.toLowerCase().includes(columnSearch.toLowerCase());
    const matchesRowMode = col.rowModes.includes(rowMode);
    return matchesSearch && matchesRowMode;
  });

  // Group columns
  const groupedColumns = filteredAvailableColumns.reduce((acc, col) => {
    const grp = col.group || 'ORDER';
    if (!acc[grp]) acc[grp] = [];
    acc[grp].push(col);
    return acc;
  }, {} as Record<string, ExportColumnDef[]>);

  // Column toggle
  const toggleColumn = (key: string) => {
    if (selectedColumns.includes(key)) {
      setSelectedColumns(selectedColumns.filter((k) => k !== key));
    } else {
      setSelectedColumns([...selectedColumns, key]);
    }
  };

  const addAllGroup = (cols: ExportColumnDef[]) => {
    const newKeys = cols.map((c) => c.key).filter((k) => !selectedColumns.includes(k));
    setSelectedColumns([...selectedColumns, ...newKeys]);
  };

  const moveColumn = (index: number, direction: 'UP' | 'DOWN') => {
    const newCols = [...selectedColumns];
    const targetIdx = direction === 'UP' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= newCols.length) return;
    const temp = newCols[index];
    newCols[index] = newCols[targetIdx];
    newCols[targetIdx] = temp;
    setSelectedColumns(newCols);
  };

  return (
    <div className="space-y-8 pb-12">
      {/* 1. PRESET SELECTOR */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex-1 w-full sm:w-auto">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              Dışa Aktarma Şablonu
            </label>
            <div className="flex items-center gap-3">
              <select
                value={selectedPresetId}
                onChange={(e) => applyPreset(e.target.value)}
                className="w-full sm:w-80 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
              >
                <option value="">Özel Yapılandırma (Boş Başla)</option>
                {presets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.isSystemDefault ? '⭐ ' : ''}
                    {preset.name} ({preset.format} · {preset.rowMode === 'ORDER' ? 'Sipariş' : 'Kalem'})
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setIsPresetModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 px-3.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              >
                <BookmarkSquareIcon className="h-4 w-4 text-indigo-500" />
                Şablon Olarak Kaydet
              </button>
            </div>
          </div>

          {/* LIVE COUNT BADGE */}
          <div className="flex items-center gap-3 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 px-4 py-3 rounded-xl">
            <SparklesIcon className={`h-5 w-5 text-indigo-600 dark:text-indigo-400 ${isCounting ? 'animate-spin' : ''}`} />
            <div>
              <div className="text-xs font-semibold text-indigo-900 dark:text-indigo-200">
                Filtreye Uyan Siparişler
              </div>
              <div className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                {count ? (
                  <>
                    {count.totalOrders.toLocaleString('tr-TR')} sipariş · {count.totalItems.toLocaleString('tr-TR')} kalem
                  </>
                ) : (
                  'Hesaplanıyor...'
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. FILTERS */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-950 text-xs font-bold text-indigo-600">
            1
          </span>
          Sipariş Filtreleri
        </h3>

        {/* Quick Date Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs text-slate-500 font-medium mr-1">Tarih:</span>
          {[
            { id: 'ALL', label: 'Tüm Zamanlar' },
            { id: 'TODAY', label: 'Bugün' },
            { id: 'YESTERDAY', label: 'Dün' },
            { id: 'LAST_7_DAYS', label: 'Son 7 Gün' },
            { id: 'THIS_MONTH', label: 'Bu Ay' },
            { id: 'LAST_MONTH', label: 'Geçen Ay' },
          ].map((btn) => (
            <button
              key={btn.id}
              type="button"
              onClick={() => applyQuickDate(btn.id)}
              className="rounded-lg px-3 py-1 text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
            >
              {btn.label}
            </button>
          ))}
        </div>

        {/* Filter Inputs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Başlangıç Tarihi
            </label>
            <input
              type="date"
              value={filters.startDate ? filters.startDate.slice(0, 10) : ''}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  startDate: e.target.value ? new Date(e.target.value).toISOString() : undefined,
                }))
              }
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Bitiş Tarihi
            </label>
            <input
              type="date"
              value={filters.endDate ? filters.endDate.slice(0, 10) : ''}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  endDate: e.target.value ? new Date(e.target.value).toISOString() : undefined,
                }))
              }
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Tarih Alanı
            </label>
            <select
              value={filters.dateField || 'createdAt'}
              onChange={(e) => setFilters((prev) => ({ ...prev, dateField: e.target.value as any }))}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white"
            >
              <option value="createdAt">Oluşturulma Tarihi</option>
              <option value="updatedAt">Güncellenme Tarihi</option>
              <option value="paidAt">Ödenme Tarihi</option>
              <option value="shippedAt">Kargoya Verilme</option>
              <option value="deliveredAt">Teslim Edilme</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Arama (No, Müşteri, Tel)
            </label>
            <input
              type="text"
              placeholder="Örn: 2026-1049"
              value={filters.search || ''}
              onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value || undefined }))}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white"
            />
          </div>
        </div>
      </div>

      {/* 3. ROW MODE */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-950 text-xs font-bold text-indigo-600">
            2
          </span>
          Satır Modu
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label
            className={`cursor-pointer rounded-2xl border p-4 transition-all ${
              rowMode === 'ORDER'
                ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 ring-2 ring-indigo-500/20'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <input
                type="radio"
                name="rowMode"
                value="ORDER"
                checked={rowMode === 'ORDER'}
                onChange={() => setRowMode('ORDER')}
                className="h-4 w-4 text-indigo-600"
              />
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  Sipariş Başına Bir Satır (ORDER)
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Her sipariş tek satırda özetlenir. Genel ciro, kargo çıkışları ve müşteri listesi için idealdir.
                </div>
              </div>
            </div>
          </label>

          <label
            className={`cursor-pointer rounded-2xl border p-4 transition-all ${
              rowMode === 'LINE_ITEM'
                ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 ring-2 ring-indigo-500/20'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <input
                type="radio"
                name="rowMode"
                value="LINE_ITEM"
                checked={rowMode === 'LINE_ITEM'}
                onChange={() => setRowMode('LINE_ITEM')}
                className="h-4 w-4 text-indigo-600"
              />
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-white">
                  Ürün Kalemi Başına Bir Satır (LINE_ITEM)
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Siparişteki her ürün ayrı bir satır olarak listelenir. Muhasebe, KDV detayları ve stok çıkışları için uygundur.
                </div>
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* 4. COLUMNS SELECTOR */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-950 text-xs font-bold text-indigo-600">
              3
            </span>
            Kolon Seçimi ({selectedColumns.length} Seçili)
          </h3>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedColumns([])}
              className="text-xs font-semibold text-red-600 hover:text-red-700"
            >
              Tümünü Kaldır
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* AVAILABLE CATALOG (Left) */}
          <div className="lg:col-span-7 border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-950/40">
            <div className="relative mb-3">
              <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Kolon ara (örn: telefon, kdv, takip)..."
                value={columnSearch}
                onChange={(e) => setColumnSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div className="max-h-96 overflow-y-auto space-y-4 pr-1">
              {Object.entries(groupedColumns).map(([groupKey, cols]) => (
                <div key={groupKey} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500 px-1">
                    <span>{GROUP_LABELS[groupKey] || groupKey}</span>
                    <button
                      type="button"
                      onClick={() => addAllGroup(cols)}
                      className="text-[10px] text-indigo-600 hover:underline"
                    >
                      + Tümünü Ekle
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {cols.map((col) => {
                      const isSelected = selectedColumns.includes(col.key);
                      return (
                        <button
                          key={col.key}
                          type="button"
                          onClick={() => toggleColumn(col.key)}
                          className={`flex items-center justify-between p-2 rounded-lg border text-left text-xs transition ${
                            isSelected
                              ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-semibold'
                              : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                          }`}
                        >
                          <span className="truncate">{col.label}</span>
                          <div className="flex items-center gap-1 ml-2 shrink-0">
                            {col.pii && (
                              <span title="Kişisel Veri (PII)" className="text-amber-500">
                                <LockClosedIcon className="h-3 w-3" />
                              </span>
                            )}
                            <span className="text-[10px] text-slate-400 font-normal">
                              {isSelected ? '✓' : '+'}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SELECTED ORDERED LIST (Right) */}
          <div className="lg:col-span-5 border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-white dark:bg-slate-900">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Dışa Aktarılacak Kolon Sırası ({selectedColumns.length})
            </div>

            <div className="max-h-96 overflow-y-auto space-y-1 pr-1">
              {selectedColumns.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400">
                  Henüz kolon seçilmedi. Soldaki katalogdan kolon ekleyin.
                </div>
              ) : (
                selectedColumns.map((colKey, idx) => {
                  const colDef = availableColumns.find((c) => c.key === colKey);
                  return (
                    <div
                      key={colKey}
                      className="flex items-center justify-between p-2 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-xs"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="text-[10px] font-mono text-slate-400 w-4">
                          {idx + 1}.
                        </span>
                        <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                          {colDef?.label || colKey}
                        </span>
                        {colDef?.pii && (
                          <span title="PII" className="text-amber-500">
                            <LockClosedIcon className="h-3 w-3" />
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moveColumn(idx, 'UP')}
                          className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                        >
                          <ChevronUpIcon className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === selectedColumns.length - 1}
                          onClick={() => moveColumn(idx, 'DOWN')}
                          className="p-0.5 text-slate-400 hover:text-slate-600 disabled:opacity-30"
                        >
                          <ChevronDownIcon className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleColumn(colKey)}
                          className="p-0.5 text-slate-400 hover:text-red-600"
                        >
                          <XMarkIcon className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 5. FORMAT & ADVANCED OPTIONS */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-950 text-xs font-bold text-indigo-600">
            4
          </span>
          Dosya Formatı ve Gelişmiş Ayarlar
        </h3>

        <div className="grid grid-cols-2 gap-4">
          <label
            className={`cursor-pointer rounded-2xl border p-4 text-center transition ${
              format === 'XLSX'
                ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 ring-2 ring-indigo-500/20'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
            }`}
          >
            <input
              type="radio"
              name="format"
              value="XLSX"
              checked={format === 'XLSX'}
              onChange={() => setFormat('XLSX')}
              className="sr-only"
            />
            <div className="text-base font-bold text-slate-900 dark:text-white">
              Microsoft Excel (.xlsx)
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Otomatik filtreler, donmuş başlık, biçimlendirilmiş para ve tarih hücreleri.
            </div>
          </label>

          <label
            className={`cursor-pointer rounded-2xl border p-4 text-center transition ${
              format === 'CSV'
                ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 ring-2 ring-indigo-500/20'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
            }`}
          >
            <input
              type="radio"
              name="format"
              value="CSV"
              checked={format === 'CSV'}
              onChange={() => setFormat('CSV')}
              className="sr-only"
            />
            <div className="text-base font-bold text-slate-900 dark:text-white">
              CSV Dosyası (.csv)
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              UTF-8 BOM destekli, ERP ve entegrasyonlar için hafif metin formatı.
            </div>
          </label>
        </div>

        {/* Advanced Accordion */}
        <div>
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 pt-2"
          >
            <span>{showAdvanced ? 'Gelişmiş Seçenekleri Gizle' : 'Gelişmiş Seçenekleri Göster'}</span>
            <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
          </button>

          {showAdvanced && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 mt-2 border-t border-slate-100 dark:border-slate-800">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  CSV Ayırıcı Karakter
                </label>
                <select
                  value={formatOptions.delimiter || ';'}
                  onChange={(e) => setFormatOptions({ ...formatOptions, delimiter: e.target.value as any })}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white"
                >
                  <option value=";">Noktalı Virgül (;) — TR Excel Uyumlu</option>
                  <option value=",">Virgül (,) — Standart</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  Saat Dilimi
                </label>
                <select
                  value={formatOptions.timezone || 'Europe/Istanbul'}
                  onChange={(e) => setFormatOptions({ ...formatOptions, timezone: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-slate-900 dark:text-white"
                >
                  <option value="Europe/Istanbul">Europe/Istanbul (UTC+3)</option>
                  <option value="UTC">UTC</option>
                  <option value="Europe/Berlin">Europe/Berlin</option>
                  <option value="America/New_York">America/New_York</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  id="includeBom"
                  checked={formatOptions.includeBom !== false}
                  onChange={(e) => setFormatOptions({ ...formatOptions, includeBom: e.target.checked })}
                  className="h-4 w-4 rounded text-indigo-600"
                />
                <label htmlFor="includeBom" className="text-xs text-slate-700 dark:text-slate-300 select-none">
                  UTF-8 BOM Ekle (Türkçe karakter düzeltmesi)
                </label>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 6. PREVIEW TABLE */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-950 text-xs font-bold text-indigo-600">
              5
            </span>
            Canlı Önizleme (İlk 20 Satır)
          </h3>

          <button
            type="button"
            onClick={() => {
              setShowPreview(true);
              fetchPreview();
            }}
            disabled={isLoadingPreview}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition"
          >
            <EyeIcon className="h-4 w-4" />
            {isLoadingPreview ? 'Yükleniyor...' : 'Önizlemeyi Yenile'}
          </button>
        </div>

        {previewError && (
          <div className="p-3 text-xs text-red-600 bg-red-50 dark:bg-red-950/40 border border-red-200 rounded-xl">
            {previewError}
          </div>
        )}

        {preview && showPreview ? (
          <div className="overflow-x-auto max-h-80 border border-slate-200 dark:border-slate-800 rounded-xl">
            <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300 whitespace-nowrap">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 sticky top-0 font-bold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  {preview.headers.map((h, i) => (
                    <th key={i} className="px-3.5 py-2.5">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {preview.rows.length === 0 ? (
                  <tr>
                    <td colSpan={preview.headers.length} className="p-6 text-center text-slate-400">
                      Filtrelere uyan sipariş verisi bulunamadı.
                    </td>
                  </tr>
                ) : (
                  preview.rows.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="px-3.5 py-2">
                          {cell !== null && cell !== undefined ? String(cell) : '-'}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
            Önizleme verilerini görüntülemek için "Önizlemeyi Yenile" butonuna tıklayın.
          </div>
        )}
      </div>

      {/* 7. TRIGGER & PROGRESS CARD */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
        {exportError && (
          <div className="p-4 rounded-xl text-sm text-red-600 bg-red-50 dark:bg-red-950/40 border border-red-200">
            {exportError}
          </div>
        )}

        {/* PROGRESS CARD */}
        {activeJob && (
          <div className="p-5 rounded-2xl border border-indigo-100 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-indigo-600 animate-ping" />
                <span className="text-sm font-semibold text-slate-900 dark:text-white">
                  Dışa Aktarma İşi: {activeJob.status}
                </span>
              </div>
              <span className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400">
                %{activeJob.progress}
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full h-3 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
              <div
                className="h-full bg-indigo-600 transition-all duration-300"
                style={{ width: `${activeJob.progress}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Satır: {activeJob.totalRows?.toLocaleString('tr-TR') || 'İşleniyor...'}</span>
              <span>Format: {activeJob.format}</span>
            </div>

            {activeJob.status === 'COMPLETED' && (
              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={downloadActiveJob}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md transition"
                >
                  <ArrowDownTrayIcon className="h-4 w-4" />
                  Dosyayı İndir ({activeJob.fileName})
                </button>
              </div>
            )}
          </div>
        )}

        {/* SUBMIT BUTTON */}
        <div className="flex items-center justify-end gap-4 pt-2">
          <button
            type="button"
            disabled={isExporting || selectedColumns.length === 0}
            onClick={startExport}
            className="inline-flex items-center gap-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-8 py-3.5 text-base font-bold text-white shadow-lg shadow-indigo-500/25 hover:from-indigo-700 hover:to-violet-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting ? (
              <>
                <ArrowPathIcon className="h-5 w-5 animate-spin" />
                Dışa Aktarılıyor...
              </>
            ) : (
              <>
                <ArrowDownTrayIcon className="h-5 w-5" />
                Dışa Aktarmayı Başlat ({format})
              </>
            )}
          </button>
        </div>
      </div>

      <PresetModal
        isOpen={isPresetModalOpen}
        onClose={() => setIsPresetModalOpen(false)}
        onSaved={fetchPresets}
        currentConfig={{
          rowMode,
          format,
          columns: selectedColumns,
          filters,
          formatOptions,
        }}
      />
    </div>
  );
}
