'use client';

import React, { useState } from 'react';
import {
  CloudArrowUpIcon,
  ArrowDownTrayIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  ArrowPathIcon,
  InformationCircleIcon,
  ArrowRightIcon,
  ArrowLeftIcon,
  DocumentTextIcon,
  BookmarkSquareIcon,
  ShieldExclamationIcon,
} from '@heroicons/react/24/outline';
import { useOrderImport } from '../hooks/useOrderImport';
import { SYSTEM_IMPORT_COLUMNS, ImportMode, MatchKey } from '../types';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';

interface Props {
  importHook: ReturnType<typeof useOrderImport>;
}

export function NewImportWizard({ importHook }: Props) {
  const params = useParams();
  const tenantPublicId = params.tenantPublicId as string;

  const {
    step,
    setStep,
    job,
    detection,
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
  } = importHook;

  const [dragOver, setDragOver] = useState(false);
  const [saveTemplateModalOpen, setSaveTemplateModalOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateSaving, setTemplateSaving] = useState(false);

  // Group SYSTEM_IMPORT_COLUMNS by category
  const columnGroups = {
    order: { label: 'Sipariş Bilgileri', cols: SYSTEM_IMPORT_COLUMNS.filter((c) => c.group === 'order') },
    customer: { label: 'Müşteri (PII)', cols: SYSTEM_IMPORT_COLUMNS.filter((c) => c.group === 'customer') },
    address: { label: 'Teslimat Adresi', cols: SYSTEM_IMPORT_COLUMNS.filter((c) => c.group === 'address') },
    shipment: { label: 'Kargo & Sevkiyat', cols: SYSTEM_IMPORT_COLUMNS.filter((c) => c.group === 'shipment') },
    item: { label: 'Ürün Kalemleri', cols: SYSTEM_IMPORT_COLUMNS.filter((c) => c.group === 'item') },
    invoice: { label: 'Fatura & Ödeme', cols: SYSTEM_IMPORT_COLUMNS.filter((c) => c.group === 'invoice' || c.group === 'payment') },
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      uploadFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      uploadFile(e.target.files[0]);
    }
  };

  const handleSaveAsTemplate = async () => {
    if (!templateName.trim()) return;
    setTemplateSaving(true);
    try {
      await api.post('/order-import-mappings', {
        name: templateName.trim(),
        mode,
        matchKey,
        columnMap,
        valueMaps,
        defaults: {
          suppressStock,
          suppressNotifications,
          suppressAutomation,
          suppressMarketplace,
          allowNonCatalogProducts,
        },
        fileHints: {
          encoding: detection?.encoding,
          delimiter: detection?.delimiter,
          headerRow: detection?.headerRow,
        },
      });
      alert('Eşleştirme şablonu başarıyla kaydedildi!');
      setSaveTemplateModalOpen(false);
    } catch (e: any) {
      alert(e.message || 'Şablon kaydedilemedi.');
    } finally {
      setTemplateSaving(false);
    }
  };

  // Check missing mandatory fields for column mapping
  const missingMandatoryFields: string[] = [];
  const mappedKeys = new Set(Object.values(columnMap));

  if (!mappedKeys.has(matchKey)) {
    missingMandatoryFields.push(`Eşleşme Anahtarı (${matchKey === 'orderNumber' ? 'Sipariş Numarası' : matchKey})`);
  }
  if (mode === 'CREATE_ONLY' || mode === 'UPSERT') {
    if (!mappedKeys.has('customerName')) missingMandatoryFields.push('Müşteri Adı');
    if (!mappedKeys.has('itemSku') && !mappedKeys.has('itemBarcode') && !mappedKeys.has('itemsSummary')) {
      missingMandatoryFields.push('Ürün Tanımı (Stok Kodu veya Barkod)');
    }
    if (!mappedKeys.has('itemUnitPrice') && !mappedKeys.has('totalAmount')) {
      missingMandatoryFields.push('Fiyat (Birim Fiyat veya Toplam Tutar)');
    }
  }

  const stepsList = [
    { num: 1, label: 'Dosya Yükle' },
    { num: 2, label: 'Ayarlar & Önizleme' },
    { num: 3, label: 'Kolon Eşleme' },
    { num: 4, label: 'Değer Eşleme' },
    { num: 5, label: 'Yan Etkiler' },
    { num: 6, label: 'Ön Kontrol (Dry-Run)' },
    { num: 7, label: 'Onay & İlerleme' },
  ];

  return (
    <div className="space-y-6">
      {/* 7-STEP PROGRESS BAR */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
          {stepsList.map((s) => {
            const isCurrent = step === s.num;
            const isCompleted = step > s.num;
            return (
              <div
                key={s.num}
                className={`flex items-center gap-2.5 p-2 rounded-xl border text-xs font-medium transition ${
                  isCurrent
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-semibold'
                    : isCompleted
                    ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 cursor-pointer'
                    : 'border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 opacity-60'
                }`}
                onClick={() => {
                  if (isCompleted && !isStarting && job?.status !== 'PROCESSING') {
                    setStep(s.num);
                  }
                }}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 ${
                    isCurrent
                      ? 'bg-indigo-600 text-white font-bold'
                      : isCompleted
                      ? 'bg-emerald-600 text-white font-bold'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {isCompleted ? '✓' : s.num}
                </div>
                <span className="truncate">{s.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* STEP 1: FILE UPLOAD */}
      {/* ========================================================================= */}
      {step === 1 && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Drag & Drop Card */}
            <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                Sipariş Dosyası Yükleyin
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                CSV veya Excel (.xlsx, .xls) formatındaki sipariş dosyanızı sürükleyip bırakın veya bilgisayarınızdan seçin.
              </p>

              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition flex flex-col items-center justify-center ${
                  dragOver
                    ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20'
                    : 'border-slate-300 dark:border-slate-700 hover:border-indigo-400 bg-slate-50/50 dark:bg-slate-800/30'
                }`}
              >
                <CloudArrowUpIcon className="h-14 w-14 text-indigo-500 mb-4 animate-pulse" />
                <p className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-1">
                  Dosyayı buraya sürükleyip bırakın
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-5">
                  CSV, XLSX veya XLS (Maksimum 20 MB, 50.000 satır)
                </p>

                <label className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold cursor-pointer shadow-sm transition">
                  <DocumentTextIcon className="h-4 w-4" />
                  Dosya Seç
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    className="hidden"
                    onChange={handleFileChange}
                    disabled={isUploading}
                  />
                </label>

                {isUploading && (
                  <div className="mt-6 flex items-center gap-2 text-indigo-600 dark:text-indigo-400 text-sm font-medium">
                    <ArrowPathIcon className="h-5 w-5 animate-spin" />
                    Dosya yükleniyor ve yapısı analiz ediliyor...
                  </div>
                )}
              </div>

              {uploadError && (
                <div className="mt-4 p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 flex items-start gap-3">
                  <XCircleIcon className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                  <div className="text-sm text-red-700 dark:text-red-300 font-medium">
                    {uploadError}
                  </div>
                </div>
              )}
            </div>

            {/* Template Download & Guide */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2">
                  Örnek Şablonlar
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                  Siparişlerinizi doğru formatta aktarmak için açıklamalı hazır şablonları indirebilirsiniz.
                </p>

                <div className="space-y-2">
                  <button
                    onClick={() => downloadTemplate('XLSX', 'LINE_ITEM')}
                    className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500 text-slate-700 dark:text-slate-300 text-xs font-semibold transition"
                  >
                    <span className="flex items-center gap-2">
                      <ArrowDownTrayIcon className="h-4 w-4 text-emerald-500" />
                      Kalem Başına Satır (Excel)
                    </span>
                    <span className="text-[10px] bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded-md font-bold">
                      Önerilen
                    </span>
                  </button>

                  <button
                    onClick={() => downloadTemplate('CSV', 'LINE_ITEM')}
                    className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500 text-slate-700 dark:text-slate-300 text-xs font-semibold transition"
                  >
                    <span className="flex items-center gap-2">
                      <ArrowDownTrayIcon className="h-4 w-4 text-sky-500" />
                      Kalem Başına Satır (CSV)
                    </span>
                  </button>

                  <button
                    onClick={() => downloadTemplate('XLSX', 'ORDER')}
                    className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500 text-slate-700 dark:text-slate-300 text-xs font-semibold transition"
                  >
                    <span className="flex items-center gap-2">
                      <ArrowDownTrayIcon className="h-4 w-4 text-indigo-500" />
                      Sipariş Başına Satır (Excel)
                    </span>
                  </button>
                </div>
              </div>

              <hr className="border-slate-200 dark:border-slate-800" />

              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2">
                  Önemli Kurallar
                </h3>
                <ul className="space-y-2 text-xs text-slate-600 dark:text-slate-400">
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-500 font-bold">•</span>
                    Türkçe Excel çıktıları (Windows-1254, noktalı virgül ayırıcı) otomatik tanınır.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-500 font-bold">•</span>
                    Aynı sipariş birden fazla kalem satırına sahipse, Sipariş Numarası aynı tutulmalıdır.
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-500 font-bold">•</span>
                    Makro içeren (.xlsm) dosyalar güvenlik nedeniyle yüklenemez.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 2: SETTINGS & LIVE PREVIEW */}
      {/* ========================================================================= */}
      {step === 2 && detection && (
        <div className="space-y-6">
          {duplicateHashWarning && (
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-start gap-3">
              <ShieldExclamationIcon className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800 dark:text-amber-200">
                <p className="font-bold">Mükerrer Dosya Uyarısı</p>
                <p className="text-xs mt-0.5">{duplicateHashWarning}</p>
              </div>
            </div>
          )}

          {/* Settings Grid */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Dosya ve İçe Aktarma Ayarları
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Import Mode */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  İçe Aktarma Modu
                </label>
                <div className="space-y-2">
                  {[
                    { id: 'CREATE_ONLY', label: 'Yalnız Yeni Siparişler (CREATE_ONLY)', desc: 'Mevcut siparişler atlanır' },
                    { id: 'UPDATE_ONLY', label: 'Yalnız Güncelleme (UPDATE_ONLY)', desc: 'Mevcut olmayanlar atlanır (kargo/durum güncellemesi için)' },
                    { id: 'UPSERT', label: 'Akıllı Eşleştirme (UPSERT)', desc: 'Varsa güncelle, yoksa yeni oluştur' },
                  ].map((m) => (
                    <div
                      key={m.id}
                      onClick={() => setMode(m.id as ImportMode)}
                      className={`p-3 rounded-xl border cursor-pointer transition text-xs ${
                        mode === m.id
                          ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 font-semibold text-slate-900 dark:text-white'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <div>{m.label}</div>
                      <div className="text-[11px] opacity-70 font-normal mt-0.5">{m.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Match Key */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Sipariş Eşleşme Anahtarı
                </label>
                <div className="space-y-2">
                  {[
                    { id: 'orderNumber', label: 'KroptOS Sipariş Numarası', desc: 'Dosyadaki sipariş no doğrudan eşlenir' },
                    { id: 'marketplaceOrderNumber', label: 'Pazaryeri / Dış Sipariş No', desc: 'Trendyol, Hepsiburada vb. harici sipariş no' },
                    { id: 'publicId', label: 'Genel Kimlik (Public ID)', desc: 'ord_... formatında sistem kimliği' },
                  ].map((k) => (
                    <div
                      key={k.id}
                      onClick={() => setMatchKey(k.id as MatchKey)}
                      className={`p-3 rounded-xl border cursor-pointer transition text-xs ${
                        matchKey === k.id
                          ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 font-semibold text-slate-900 dark:text-white'
                          : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <div>{k.label}</div>
                      <div className="text-[11px] opacity-70 font-normal mt-0.5">{k.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* File details */}
              <div className="space-y-4 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                <div>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Format: </span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">{detection.format}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Kodlama: </span>
                  <span className="font-mono">{detection.encoding}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Ayırıcı: </span>
                  <span className="font-mono">{detection.delimiter === ';' ? '; (Noktalı virgül)' : detection.delimiter === ',' ? ', (Virgül)' : detection.delimiter || 'Yok'}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Başlık Satırı: </span>
                  <span>{detection.headerRow}. satır</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Tahmini Satır: </span>
                  <span className="font-bold">{detection.totalEstimatedRows}</span>
                </div>
              </div>
            </div>

            {/* Live Preview Table */}
            <div>
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                Dosya Önizlemesi (İlk 10 Satır)
              </h4>
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl max-h-72">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 dark:bg-slate-800 sticky top-0">
                    <tr>
                      <th className="p-2.5 font-bold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">#</th>
                      {detection.headers.map((h, i) => (
                        <th key={i} className="p-2.5 font-bold text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {detection.sampleRows.map((row, rIdx) => (
                      <tr key={rIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="p-2.5 text-slate-400 font-mono">{rIdx + 1}</td>
                        {row.map((cell, cIdx) => (
                          <td key={cIdx} className="p-2.5 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Navigation Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-semibold transition"
              >
                <ArrowLeftIcon className="h-4 w-4" />
                Geri
              </button>

              <button
                onClick={() => setStep(3)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-sm transition"
              >
                Kolon Eşlemeye Geç
                <ArrowRightIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 3: COLUMN MAPPING */}
      {/* ========================================================================= */}
      {step === 3 && detection && (
        <div className="space-y-6">
          {missingMandatoryFields.length > 0 && (
            <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 flex items-start gap-3">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
              <div className="text-sm text-red-800 dark:text-red-200">
                <p className="font-bold">Eksik Zorunlu Alanlar</p>
                <p className="text-xs mt-1">
                  Lütfen aşağıdaki alanları dosyanızdaki kolonlarla eşleştirin:
                </p>
                <ul className="list-disc list-inside text-xs mt-1 space-y-0.5 font-medium">
                  {missingMandatoryFields.map((f, idx) => (
                    <li key={idx}>{f}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Kolon Eşleştirme
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Dosyanızdaki sütun başlıklarını KroptOS alanlarıyla eşleştirin.
                </p>
              </div>

              <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                {Object.keys(columnMap).length} / {detection.headers.length} Kolon Eşleşti
              </span>
            </div>

            <div className="border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
              <div className="grid grid-cols-12 bg-slate-50 dark:bg-slate-800/60 p-3 text-xs font-bold text-slate-600 dark:text-slate-300">
                <div className="col-span-5">Dosyadaki Kolon & Örnek Değer</div>
                <div className="col-span-2 text-center">Eşleşme Durumu</div>
                <div className="col-span-5">KroptOS Sistem Alanı</div>
              </div>

              {detection.headers.map((header) => {
                const mappedKey = columnMap[header] || '';
                const sampleVal = detection.sampleRows[0]?.[detection.headers.indexOf(header)] || '';
                const isAuto = importHook.mappingSuggestion?.columnMap?.[header] === mappedKey;

                return (
                  <div
                    key={header}
                    className="grid grid-cols-12 p-3 items-center hover:bg-slate-50 dark:hover:bg-slate-800/40 text-xs transition"
                  >
                    <div className="col-span-5">
                      <div className="font-semibold text-slate-800 dark:text-slate-200">{header}</div>
                      {sampleVal && (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-xs mt-0.5 font-mono">
                          Örnek: {sampleVal}
                        </div>
                      )}
                    </div>

                    <div className="col-span-2 text-center">
                      {mappedKey ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
                          <CheckCircleIcon className="h-3.5 w-3.5" />
                          {isAuto ? 'Otomatik' : 'Eşleşti'}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-400">Yoksayıldı</span>
                      )}
                    </div>

                    <div className="col-span-5">
                      <select
                        value={mappedKey}
                        onChange={(e) => {
                          const val = e.target.value;
                          setColumnMap((prev) => {
                            const updated = { ...prev };
                            if (!val) {
                              delete updated[header];
                            } else {
                              updated[header] = val;
                            }
                            return updated;
                          });
                        }}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">-- Yoksay (İçe Aktarma) --</option>
                        {Object.entries(columnGroups).map(([grpKey, group]) => (
                          <optgroup key={grpKey} label={group.label}>
                            {group.cols.map((col) => (
                              <option key={col.key} value={col.key}>
                                {col.label} ({col.key})
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Navigation Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setStep(2)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-semibold transition"
              >
                <ArrowLeftIcon className="h-4 w-4" />
                Geri
              </button>

              <button
                onClick={saveMapping}
                disabled={missingMandatoryFields.length > 0}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold shadow-sm transition"
              >
                İleri: Değer Eşleme & Ayarlar
                <ArrowRightIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 4: VALUE MAPPING */}
      {/* ========================================================================= */}
      {step === 4 && unmappedValues && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Değer Eşleştirme (Sistem Karşılıkları)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Dosyanızda geçen durum, kargo ve ödeme metinlerini KroptOS standart değerleriyle eşleştirin.
              </p>
            </div>

            {/* Unmapped Status Values */}
            {unmappedValues.status && unmappedValues.status.length > 0 && (
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  Sipariş Durumu Eşlemeleri
                </h4>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {unmappedValues.status.map((item) => (
                    <div key={item.value} className="flex items-center justify-between py-2 text-xs">
                      <div>
                        <span className="font-semibold text-slate-900 dark:text-white">{item.value}</span>
                        <span className="ml-2 text-[10px] text-slate-400 font-mono">({item.count} satırda geçiyor)</span>
                      </div>
                      <select
                        value={valueMaps['status']?.[item.value] || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setValueMaps((prev) => ({
                            ...prev,
                            status: { ...(prev.status || {}), [item.value]: val },
                          }));
                        }}
                        className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs"
                      >
                        <option value="">-- Karşılık Seçin --</option>
                        <option value="pending">Beklemede (pending)</option>
                        <option value="processing">Hazırlanıyor / İşlemde (processing)</option>
                        <option value="shipped">Kargoya Verildi (shipped)</option>
                        <option value="out_for_delivery">Dağıtımda (out_for_delivery)</option>
                        <option value="delivered">Teslim Edildi (delivered)</option>
                        <option value="cancelled">İptal Edildi (cancelled)</option>
                        <option value="returned">İade Edildi (returned)</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Unmapped Catalog Products */}
            {unmappedValues.products && unmappedValues.products.length > 0 && (
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                      Katalogda Bulunamayan Ürünler ({unmappedValues.products.length} adet)
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Bu stok kodları mağazanızın ürün kataloğunda eşleşmedi.
                    </p>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={allowNonCatalogProducts}
                      onChange={(e) => setAllowNonCatalogProducts(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                    />
                    Katalog Dışı Kalem Olarak Ekle
                  </label>
                </div>

                <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 text-xs font-mono">
                  {unmappedValues.products.slice(0, 20).map((p) => (
                    <div key={p.value} className="py-1.5 text-slate-600 dark:text-slate-400">
                      • {p.value}
                    </div>
                  ))}
                  {unmappedValues.products.length > 20 && (
                    <div className="py-1 text-slate-400 text-[11px]">
                      ve {unmappedValues.products.length - 20} ürün daha...
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Navigation Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setStep(3)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-semibold transition"
              >
                <ArrowLeftIcon className="h-4 w-4" />
                Geri
              </button>

              <button
                onClick={saveValueMaps}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-sm transition"
              >
                Yan Etkiler Adımına Geç
                <ArrowRightIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 5: SIDE EFFECTS */}
      {/* ========================================================================= */}
      {step === 5 && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-6">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Yan Etkiler ve Güvenlik Ayarları
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                İçe aktarılan siparişlerin stok, e-posta bildirimi ve otomasyon tetikleme durumlarını yapılandırın.
              </p>
            </div>

            <div className="space-y-4">
              {/* Suppress Stock */}
              <div className="flex items-start justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                <div className="space-y-1">
                  <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    Stok Hareketlerini Yansıtma (Stok Düşüşünü Engelle)
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 max-w-xl">
                    Geçmiş veya dışarıdan aktarılan siparişler içe alınırken mağaza stok seviyesinin bozulmasını önler.
                    (Varsayılan olarak güvenli: açık).
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={suppressStock}
                  onChange={(e) => setSuppressStock(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 h-5 w-5 mt-1"
                />
              </div>

              {/* Suppress Notifications */}
              <div className="flex items-start justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                <div className="space-y-1">
                  <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    Müşteri E-Posta Bildirimlerini Engelle
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 max-w-xl">
                    Aktarılan siparişler için alıcılara otomatik &quot;Siparişiniz Alındı&quot; veya durum güncelleme e-postaları gitmesini önler.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={suppressNotifications}
                  onChange={(e) => setSuppressNotifications(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 h-5 w-5 mt-1"
                />
              </div>

              {/* Suppress Automation */}
              <div className="flex items-start justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                <div className="space-y-1">
                  <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    Otomasyon Kurallarını Engelle
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 max-w-xl">
                    Mevcut sipariş otomasyon kurallarının (etiketleme, havuz onayları vb.) bu içe aktarmada tetiklenmesini engeller.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={suppressAutomation}
                  onChange={(e) => setSuppressAutomation(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 h-5 w-5 mt-1"
                />
              </div>

              {/* Suppress Marketplace Sync */}
              <div className="flex items-start justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                <div className="space-y-1">
                  <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    Pazaryerine Geri Senkronu Engelle
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 max-w-xl">
                    Trendyol veya Hepsiburada gibi entegrasyonlara sipariş durumu veya kargo bilgisinin geri basılmasını önler.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={suppressMarketplace}
                  onChange={(e) => setSuppressMarketplace(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 h-5 w-5 mt-1"
                />
              </div>

              {/* All or Nothing */}
              <div className="flex items-start justify-between p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                <div className="space-y-1">
                  <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    Hepsi ya da Hiçbiri (All-or-Nothing)
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 max-w-xl">
                    Dosyada tek bir satır bile hatalı çıkarsa hiçbir sipariş işlenmez ve tüm aktarım iptal edilir.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={allOrNothing}
                  onChange={(e) => setAllOrNothing(e.target.checked)}
                  className="rounded text-indigo-600 focus:ring-indigo-500 h-5 w-5 mt-1"
                />
              </div>
            </div>

            {/* Navigation Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setStep(3)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-semibold transition"
              >
                <ArrowLeftIcon className="h-4 w-4" />
                Geri
              </button>

              <button
                onClick={runValidation}
                disabled={isValidating}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-semibold shadow-sm transition"
              >
                {isValidating ? (
                  <>
                    <ArrowPathIcon className="h-4 w-4 animate-spin" />
                    Ön Kontrol Çalışıyor...
                  </>
                ) : (
                  <>
                    Ön Kontrolü (Dry-Run) Başlat
                    <ArrowRightIcon className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 6: DRY RUN RESULTS */}
      {/* ========================================================================= */}
      {step === 6 && validationResult && (
        <div className="space-y-6">
          {/* Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Oluşturulacak</div>
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                {validationResult.summary.validOrders}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Yeni sipariş kaydı</div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Atlanacak</div>
              <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                {validationResult.summary.skippedCount}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Mevcut veya mod gereği atlanan</div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Hatalı Siparişler</div>
              <div className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
                {validationResult.summary.invalidOrders}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Düzeltilmesi gereken</div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">Toplam Sipariş Grubu</div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
                {validationResult.summary.totalOrders}
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">Dosyadaki tekil sipariş sayısı</div>
            </div>
          </div>

          {/* Problem rows table */}
          {validationResult.sampleProblems && validationResult.sampleProblems.length > 0 && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Ön Kontrol Hataları ve Uyarılar ({validationResult.sampleProblems.length})
                </h3>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-bold">
                    <tr>
                      <th className="p-2.5">Satır No</th>
                      <th className="p-2.5">Sipariş No</th>
                      <th className="p-2.5">Durum</th>
                      <th className="p-2.5">Kolon</th>
                      <th className="p-2.5">Açıklama</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {validationResult.sampleProblems.map((prob, idx) => {
                      const err = prob.errors?.[0];
                      const warn = prob.warnings?.list?.[0] || prob.warnings?.[0];
                      const isErr = !!err;

                      return (
                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                          <td className="p-2.5 font-mono text-slate-500">
                            {prob.rowNumbers?.join(', ') || '-'}
                          </td>
                          <td className="p-2.5 font-semibold text-slate-900 dark:text-white">
                            {prob.groupKey}
                          </td>
                          <td className="p-2.5">
                            {isErr ? (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400">
                                HATA
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
                                UYARI
                              </span>
                            )}
                          </td>
                          <td className="p-2.5 font-mono text-slate-600 dark:text-slate-400">
                            {err?.column || warn?.column || '-'}
                          </td>
                          <td className="p-2.5 text-slate-700 dark:text-slate-300">
                            {err?.message || warn?.message || '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Navigation Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setStep(5)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-semibold transition"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Geri
            </button>

            <button
              onClick={startImport}
              disabled={isStarting || (allOrNothing && validationResult.summary.invalidOrders > 0)}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold shadow-sm transition"
            >
              <CheckCircleIcon className="h-4 w-4" />
              {validationResult.summary.validOrders} Siparişi İçe Aktar
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* STEP 7: CONFIRM & PROCESSING / COMPLETE */}
      {/* ========================================================================= */}
      {step === 7 && job && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-sm space-y-6 text-center">
            {job.status === 'PROCESSING' || job.status === 'QUEUED' ? (
              <div className="space-y-4 max-w-lg mx-auto py-6">
                <ArrowPathIcon className="h-14 w-14 text-indigo-600 animate-spin mx-auto" />
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  Siparişler İçe Aktarılıyor...
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Lütfen bekleyin, siparişleriniz işlem sırasına alındı ve veritabanına yazılıyor.
                </p>

                {/* Progress Bar */}
                <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-3.5 overflow-hidden mt-6">
                  <div
                    className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                    style={{ width: `${Math.max(5, job.progress || 0)}%` }}
                  />
                </div>
                <div className="text-xs font-mono text-slate-500 dark:text-slate-400">
                  %{job.progress || 0} Tamamlandı
                </div>
              </div>
            ) : job.status === 'COMPLETED' || job.status === 'COMPLETED_WITH_ERRORS' ? (
              <div className="space-y-6 max-w-xl mx-auto py-4">
                <CheckCircleIcon className="h-16 w-16 text-emerald-500 mx-auto" />
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
                  İçe Aktarma Tamamlandı!
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Siparişleriniz başarıyla içeri aktarıldı. Detaylar ve sayaçlar aşağıda yer almaktadır.
                </p>

                {/* Results Card */}
                <div className="grid grid-cols-3 gap-4 text-left border border-slate-200 dark:border-slate-800 p-4 rounded-xl">
                  <div>
                    <div className="text-xs text-slate-500">Oluşturulan</div>
                    <div className="text-lg font-bold text-emerald-600">{job.createdCount}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Güncellenen</div>
                    <div className="text-lg font-bold text-indigo-600">{job.updatedCount}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500">Hatalı / Atlanan</div>
                    <div className="text-lg font-bold text-red-500">{job.failedCount + job.skippedCount}</div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  <Link
                    href={`/t/${tenantPublicId}/orders`}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-sm transition"
                  >
                    Siparişleri Görüntüle
                  </Link>

                  <button
                    onClick={() => setSaveTemplateModalOpen(true)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-semibold transition"
                  >
                    <BookmarkSquareIcon className="h-4 w-4 text-indigo-500" />
                    Şablon Olarak Kaydet
                  </button>

                  <button
                    onClick={resetWizard}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm font-semibold transition"
                  >
                    Yeni İçe Aktarma
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 max-w-lg mx-auto py-6">
                <XCircleIcon className="h-14 w-14 text-red-500 mx-auto" />
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  İşlem Başarısız Oldu ({job.status})
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  İçe aktarma sırasında bir hata oluştu veya işlem iptal edildi.
                </p>
                <button
                  onClick={resetWizard}
                  className="px-5 py-2.5 rounded-xl bg-slate-800 text-white text-sm font-semibold"
                >
                  Yeniden Başlat
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SAVE TEMPLATE MODAL */}
      {saveTemplateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Eşleştirme Şablonu Olarak Kaydet
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Bu kolon ve değer eşleştirmelerini ileride aynı kaynaktan yükleyeceğiniz dosyalarda otomatik kullanmak için şablon olarak kaydedin.
            </p>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Şablon Adı
              </label>
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Örn: Eski ERP Aylık Sipariş Dosyası"
                className="w-full mt-1 px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setSaveTemplateModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Vazgeç
              </button>
              <button
                onClick={handleSaveAsTemplate}
                disabled={templateSaving || !templateName.trim()}
                className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold disabled:opacity-50"
              >
                {templateSaving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
