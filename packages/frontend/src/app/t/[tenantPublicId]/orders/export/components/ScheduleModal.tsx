'use client';

import { useState, useEffect } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { OrderExportPreset, OrderExportSchedule } from '../types';

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  presets: OrderExportPreset[];
  editingSchedule?: OrderExportSchedule | null;
  onSubmit: (data: any) => Promise<boolean>;
}

export function ScheduleModal({
  isOpen,
  onClose,
  onSaved,
  presets,
  editingSchedule,
  onSubmit,
}: ScheduleModalProps) {
  const [name, setName] = useState('');
  const [presetId, setPresetId] = useState('');
  const [frequency, setFrequency] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM'>('WEEKLY');
  const [customCron, setCustomCron] = useState('0 8 * * 1');
  const [relativeRange, setRelativeRange] = useState('LAST_7_DAYS');
  const [recipientsStr, setRecipientsStr] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editingSchedule) {
      setName(editingSchedule.name);
      setPresetId(editingSchedule.presetId);
      setCustomCron(editingSchedule.cron);
      setRelativeRange(editingSchedule.relativeRange);
      setRecipientsStr(editingSchedule.recipients?.join(', ') || '');
      setIsActive(editingSchedule.isActive);
      if (editingSchedule.cron === '0 8 * * *') setFrequency('DAILY');
      else if (editingSchedule.cron === '0 8 * * 1') setFrequency('WEEKLY');
      else if (editingSchedule.cron === '0 8 1 * *') setFrequency('MONTHLY');
      else setFrequency('CUSTOM');
    } else {
      setName('');
      setPresetId(presets[0]?.id || '');
      setFrequency('WEEKLY');
      setCustomCron('0 8 * * 1');
      setRelativeRange('LAST_7_DAYS');
      setRecipientsStr('');
      setIsActive(true);
    }
  }, [editingSchedule, presets, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Lütfen bir isim girin.');
      return;
    }
    if (!presetId) {
      setError('Lütfen bir şablon seçin.');
      return;
    }

    let finalCron = customCron;
    if (frequency === 'DAILY') finalCron = '0 8 * * *';
    else if (frequency === 'WEEKLY') finalCron = '0 8 * * 1';
    else if (frequency === 'MONTHLY') finalCron = '0 8 1 * *';

    const recipients = recipientsStr
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    setIsSaving(true);
    setError(null);

    const payload = {
      name: name.trim(),
      presetId,
      cron: finalCron,
      relativeRange,
      recipients,
      isActive,
      timezone: 'Europe/Istanbul',
    };

    const ok = await onSubmit(payload);
    setIsSaving(false);
    if (ok) {
      onSaved();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-6 py-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            {editingSchedule ? 'Zamanlanmış Görevi Düzenle' : 'Yeni Zamanlanmış Görev Oluştur'}
          </h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-xl">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Görev Adı *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Örn: Haftalık Pazartesi Sipariş Özeti"
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              Kullanılacak Şablon *
            </label>
            <select
              value={presetId}
              onChange={(e) => setPresetId(e.target.value)}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            >
              {presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.format} · {p.rowMode === 'ORDER' ? 'Sipariş' : 'Kalem'})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Çalışma Sıklığı
              </label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as any)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="DAILY">Her Gün (08:00)</option>
                <option value="WEEKLY">Her Pazartesi (08:00)</option>
                <option value="MONTHLY">Her Ayın 1'i (08:00)</option>
                <option value="CUSTOM">Özel Cron İfadesi</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Veri Zaman Aralığı
              </label>
              <select
                value={relativeRange}
                onChange={(e) => setRelativeRange(e.target.value)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="YESTERDAY">Dün</option>
                <option value="LAST_7_DAYS">Son 7 Gün</option>
                <option value="LAST_WEEK">Geçen Hafta (Pzt-Paz)</option>
                <option value="LAST_MONTH">Geçen Ay</option>
                <option value="TODAY">Bugün</option>
                <option value="THIS_WEEK">Bu Hafta</option>
                <option value="THIS_MONTH">Bu Ay</option>
                <option value="LAST_30_DAYS">Son 30 Gün</option>
              </select>
            </div>
          </div>

          {frequency === 'CUSTOM' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
                Cron İfadesi
              </label>
              <input
                type="text"
                value={customCron}
                onChange={(e) => setCustomCron(e.target.value)}
                placeholder="Örn: 0 9 * * 1-5 (Hafta içi 09:00)"
                className="w-full font-mono rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1">
              E-posta Alıcıları (Virgülle Ayrılmış)
            </label>
            <input
              type="text"
              value={recipientsStr}
              onChange={(e) => setRecipientsStr(e.target.value)}
              placeholder="muhasebe@sirket.com, operasyon@sirket.com"
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Görev tamamlandığında indirme linki içeren bildirim e-postası gönderilir.
            </p>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <input
              type="checkbox"
              id="isActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="isActive" className="text-sm font-medium text-slate-700 dark:text-slate-300 select-none">
              Zamanlama aktif olsun
            </label>
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
              {isSaving ? 'Kaydediliyor...' : editingSchedule ? 'Güncelle' : 'Oluştur'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
