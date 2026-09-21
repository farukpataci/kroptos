'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { ExportFormat, FormatOptions, OrderExportFilters, RowMode } from '../types';

interface PresetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  currentConfig: {
    rowMode: RowMode;
    format: ExportFormat;
    columns: string[];
    filters: OrderExportFilters;
    formatOptions: FormatOptions;
  };
}

export function PresetModal({ isOpen, onClose, onSaved, currentConfig }: PresetModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isShared, setIsShared] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Lütfen şablon için bir ad girin.');
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await api.post('/v1/orders/export/presets', {
        name: name.trim(),
        description: description.trim() || undefined,
        isShared,
        rowMode: currentConfig.rowMode,
        format: currentConfig.format,
        columns: currentConfig.columns,
        filters: currentConfig.filters,
        formatOptions: currentConfig.formatOptions,
      });
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Şablon kaydedilemedi.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Şablon Olarak Kaydet
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-xl">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Şablon Adı *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Örn: Haftalık Muhasebe Raporu"
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Açıklama (İsteğe Bağlı)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Bu şablon hangi kolonları ve filtreleri içerir?"
              rows={2}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-3 pt-1">
            <input
              type="checkbox"
              id="isShared"
              checked={isShared}
              onChange={(e) => setIsShared(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="isShared" className="text-sm font-medium text-slate-700 dark:text-slate-300 select-none">
              Mağazadaki tüm ekip üyeleriyle paylaş
            </label>
          </div>

          <div className="pt-2 text-xs text-slate-500 dark:text-slate-400">
            Seçili {currentConfig.columns.length} kolon, satır modu ({currentConfig.rowMode === 'ORDER' ? 'Sipariş' : 'Kalem'}) ve filtreler kaydedilecektir.
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Vazgeç
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              {isSaving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
