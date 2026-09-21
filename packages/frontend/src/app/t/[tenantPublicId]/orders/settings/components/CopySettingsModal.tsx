import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import {
  XMarkIcon,
  ArrowPathIcon,
  DocumentDuplicateIcon,
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';

interface StoreOption {
  id: string;
  name: string;
}

interface Props {
  isOpen: boolean;
  activeStoreId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function CopySettingsModal({ isOpen, activeStoreId, onClose, onSuccess }: Props) {
  const [tab, setTab] = useState<'copy' | 'json'>('copy');
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      api
        .get<any[]>('/api/stores')
        .then((res) => {
          const list = Array.isArray(res) ? res : [];
          setStores(list.filter((s) => s.id !== activeStoreId));
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [isOpen, activeStoreId]);

  if (!isOpen) return null;

  const handleToggleStore = (id: string) => {
    setSelectedStoreIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id],
    );
  };

  const handleCopy = async () => {
    if (!activeStoreId || selectedStoreIds.length === 0) return;
    setProcessing(true);
    try {
      await api.post('/api/order-settings/copy', {
        sourceStoreId: activeStoreId,
        targetStoreIds: selectedStoreIds,
      });
      alert('Ayarlar seçilen mağazalara başarıyla kopyalandı.');
      onSuccess();
      onClose();
    } catch (err: any) {
      alert(err?.message || 'Kopyalama işlemi başarısız.');
    } finally {
      setProcessing(false);
    }
  };

  const handleExport = async () => {
    if (!activeStoreId) return;
    try {
      const data = await api.get<any>('/api/order-settings/export');
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `order-settings-${activeStoreId}-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(err?.message || 'Dışa aktarma başarısız.');
    }
  };

  const handleImport = async () => {
    setJsonError(null);
    try {
      const parsed = JSON.parse(jsonInput);
      setProcessing(true);
      await api.post('/api/order-settings/import', parsed);
      alert('Ayarlar JSON dosyasından başarıyla içe aktarıldı.');
      onSuccess();
      onClose();
    } catch (err: any) {
      setJsonError(err?.message || 'Geçersiz JSON verisi.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <DocumentDuplicateIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Ayarları Kopyala & Dışa/İçe Aktar
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setTab('copy')}
            className={`pb-2 px-3 text-xs font-semibold border-b-2 transition ${
              tab === 'copy'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            Mağazalara Kopyala
          </button>
          <button
            type="button"
            onClick={() => setTab('json')}
            className={`pb-2 px-3 text-xs font-semibold border-b-2 transition ${
              tab === 'json'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
            }`}
          >
            JSON Dışa / İçe Aktar
          </button>
        </div>

        {tab === 'copy' ? (
          <div className="space-y-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Bu mağazadaki tüm özel ayarlar (hassas numaralandırma ve fatura serileri hariç) seçilen
              hedef mağazalara kopyalanır.
            </p>

            {loading ? (
              <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <ArrowPathIcon className="w-4 h-4 animate-spin" />
                Mağazalar aranıyor...
              </div>
            ) : stores.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400 italic">
                Aynı firmaya ait başka mağaza bulunamadı.
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-1.5 p-1 border rounded-lg border-slate-200 dark:border-slate-800">
                {stores.map((s) => (
                  <label
                    key={s.id}
                    className="flex items-center gap-2.5 p-2 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer text-xs"
                  >
                    <input
                      type="checkbox"
                      checked={selectedStoreIds.includes(s.id)}
                      onChange={() => handleToggleStore(s.id)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="font-medium text-slate-900 dark:text-white">
                      {s.name}
                    </span>
                  </label>
                ))}
              </div>
            )}

            <div className="flex justify-end pt-3">
              <button
                type="button"
                disabled={processing || selectedStoreIds.length === 0}
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow disabled:opacity-50 transition"
              >
                {processing ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <CheckIcon className="w-4 h-4" />}
                Seçili Mağazalara Kopyala ({selectedStoreIds.length})
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Export Section */}
            <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-900 dark:text-white block">
                  Mevcut Ayarları İndir
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Tüm ayarları JSON formatında yedekleyin.
                </span>
              </div>
              <button
                type="button"
                onClick={handleExport}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition"
              >
                <ArrowDownTrayIcon className="w-4 h-4 text-indigo-600" />
                İndir (JSON)
              </button>
            </div>

            {/* Import Section */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-900 dark:text-white block">
                JSON Yapıştırarak İçe Aktar
              </label>
              <textarea
                rows={4}
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                placeholder='{"order.general.currency": "TRY", ...}'
                className="w-full font-mono text-xs p-3 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
              {jsonError && (
                <p className="text-xs text-red-600 dark:text-red-400">{jsonError}</p>
              )}
              <div className="flex justify-end">
                <button
                  type="button"
                  disabled={processing || !jsonInput.trim()}
                  onClick={handleImport}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow disabled:opacity-50 transition"
                >
                  {processing ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <ArrowUpTrayIcon className="w-4 h-4" />}
                  İçe Aktar ve Uygula
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
