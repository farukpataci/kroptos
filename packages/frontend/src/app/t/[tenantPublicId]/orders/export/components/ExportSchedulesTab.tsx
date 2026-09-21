'use client';

import { useState } from 'react';
import {
  PlusIcon,
  PlayIcon,
  PencilSquareIcon,
  TrashIcon,
  ClockIcon,
  CalendarDaysIcon,
} from '@heroicons/react/24/outline';
import { useExportSchedules } from '../hooks/useExportSchedules';
import { OrderExportPreset, OrderExportSchedule } from '../types';
import { ScheduleModal } from './ScheduleModal';

interface ExportSchedulesTabProps {
  presets: OrderExportPreset[];
}

function formatCronLabel(cron: string): string {
  if (cron === '0 8 * * *') return 'Her Gün 08:00';
  if (cron === '0 8 * * 1') return 'Her Pazartesi 08:00';
  if (cron === '0 8 1 * *') return 'Her Ayın 1\'i 08:00';
  return `Cron: ${cron}`;
}

function formatRangeLabel(range: string): string {
  const map: Record<string, string> = {
    YESTERDAY: 'Dün',
    LAST_7_DAYS: 'Son 7 Gün',
    LAST_WEEK: 'Geçen Hafta',
    LAST_MONTH: 'Geçen Ay',
    TODAY: 'Bugün',
    THIS_WEEK: 'Bu Hafta',
    THIS_MONTH: 'Bu Ay',
    LAST_30_DAYS: 'Son 30 Gün',
  };
  return map[range] || range;
}

export function ExportSchedulesTab({ presets }: ExportSchedulesTabProps) {
  const {
    schedules,
    isLoading,
    error,
    refreshSchedules,
    toggleScheduleActive,
    runScheduleNow,
    deleteSchedule,
    createSchedule,
    updateSchedule,
  } = useExportSchedules();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<OrderExportSchedule | null>(null);

  const handleOpenCreate = () => {
    setEditingSchedule(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (schedule: OrderExportSchedule) => {
    setEditingSchedule(schedule);
    setIsModalOpen(true);
  };

  const handleModalSubmit = async (data: any) => {
    if (editingSchedule) {
      return updateSchedule(editingSchedule.id, data);
    } else {
      return createSchedule(data);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Otomatik & Zamanlanmış Dışa Aktarımlar
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Belirlenen gün ve saatte raporları otomatik üretir ve e-posta ile alıcılara ulaştırır.
          </p>
        </div>

        <button
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition"
        >
          <PlusIcon className="h-4 w-4" />
          Yeni Zamanlama Ekle
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl text-sm text-red-600 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900">
          {error}
        </div>
      )}

      {/* Schedules List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {schedules.length === 0 ? (
          <div className="col-span-full bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center text-slate-500 dark:text-slate-400">
            <CalendarDaysIcon className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600 mb-3" />
            Henüz tanımlanmış bir zamanlama bulunmuyor.
            <div className="mt-3">
              <button
                onClick={handleOpenCreate}
                className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 font-medium text-sm"
              >
                + İlk zamanlamayı oluşturun
              </button>
            </div>
          </div>
        ) : (
          schedules.map((schedule) => (
            <div
              key={schedule.id}
              className={`flex flex-col justify-between rounded-2xl border p-5 bg-white dark:bg-slate-900 transition-all shadow-sm ${
                schedule.isActive
                  ? 'border-slate-200 dark:border-slate-800'
                  : 'border-slate-200/60 dark:border-slate-800/60 opacity-75'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <h4 className="font-semibold text-slate-900 dark:text-white text-base">
                      {schedule.name}
                    </h4>
                    <div className="text-xs text-indigo-600 dark:text-indigo-400 font-medium mt-0.5">
                      Şablon: {schedule.preset?.name || 'Bilinmeyen Şablon'}
                    </div>
                  </div>

                  {/* Active Toggle */}
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={schedule.isActive}
                      onChange={() => toggleScheduleActive(schedule.id, schedule.isActive)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3 my-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-xs">
                  <div>
                    <span className="text-slate-400 block mb-0.5">Sıklık & Zaman</span>
                    <span className="font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1">
                      <ClockIcon className="h-3.5 w-3.5 text-slate-400" />
                      {formatCronLabel(schedule.cron)}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5">Kapsam</span>
                    <span className="font-medium text-slate-700 dark:text-slate-200">
                      {formatRangeLabel(schedule.relativeRange)}
                    </span>
                  </div>
                </div>

                {schedule.recipients && schedule.recipients.length > 0 && (
                  <div className="text-xs text-slate-500 dark:text-slate-400 mb-3 truncate">
                    <span className="font-medium text-slate-600 dark:text-slate-300">Alıcılar: </span>
                    {schedule.recipients.join(', ')}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
                <div>
                  {schedule.lastRunAt ? (
                    <span>
                      Son: {new Date(schedule.lastRunAt).toLocaleDateString('tr-TR')}
                    </span>
                  ) : (
                    <span>Henüz çalışmadı</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => runScheduleNow(schedule.id)}
                    title="Şimdi Çalıştır"
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg border border-indigo-200 dark:border-indigo-800 transition"
                  >
                    <PlayIcon className="h-3.5 w-3.5" />
                    Çalıştır
                  </button>
                  <button
                    onClick={() => handleOpenEdit(schedule)}
                    title="Düzenle"
                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition"
                  >
                    <PencilSquareIcon className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => deleteSchedule(schedule.id)}
                    title="Sil"
                    className="p-1 text-slate-400 hover:text-red-600 rounded-lg transition"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <ScheduleModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSaved={refreshSchedules}
        presets={presets}
        editingSchedule={editingSchedule}
        onSubmit={handleModalSubmit}
      />
    </div>
  );
}
