import React, { useEffect } from 'react';
import { useOrderSettingsHistory } from '../hooks/useOrderSettingsHistory';
import {
  XMarkIcon,
  ArrowPathIcon,
  ArrowUturnLeftIcon,
  ClockIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onReverted: () => void;
}

export function HistoryDrawer({ isOpen, onClose, onReverted }: Props) {
  const {
    loading,
    items,
    total,
    page,
    totalPages,
    reverting,
    fetchHistory,
    revertChangeSet,
  } = useOrderSettingsHistory();

  useEffect(() => {
    if (isOpen) {
      fetchHistory(1);
    }
  }, [isOpen, fetchHistory]);

  if (!isOpen) return null;

  // Group items by changeSetId
  const grouped = new Map<string, typeof items>();
  for (const item of items) {
    const list = grouped.get(item.changeSetId) || [];
    list.push(item);
    grouped.set(item.changeSetId, list);
  }

  const handleRevert = async (changeSetId: string) => {
    if (!window.confirm('Bu değişiklik setini geri almak istediğinize emin misiniz? Eski ayar değerleri yeniden yüklenecektir.')) {
      return;
    }
    try {
      await revertChangeSet(changeSetId);
      onReverted();
    } catch (err: any) {
      alert(err?.message || 'Geri alma işlemi başarısız oldu.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/60 backdrop-blur-sm flex justify-end">
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClockIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Ayar Değişiklik Geçmişi
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading && items.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
              <ArrowPathIcon className="w-5 h-5 animate-spin" />
              <span>Geçmiş yükleniyor...</span>
            </div>
          ) : Array.from(grouped.entries()).length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-sm">
              Henüz kaydedilmiş bir ayar değişikliği bulunmuyor.
            </div>
          ) : (
            Array.from(grouped.entries()).map(([changeSetId, changeLogs]) => {
              const first = changeLogs[0];
              const dateStr = new Date(first.createdAt).toLocaleString('tr-TR');
              const author = first.changedBy
                ? `${first.changedBy.firstName || ''} ${first.changedBy.lastName || ''} (${first.changedBy.email})`
                : 'Sistem';

              return (
                <div
                  key={changeSetId}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                        <ClockIcon className="w-3.5 h-3.5" />
                        <span>{dateStr}</span>
                        <span>·</span>
                        <span className="font-mono text-[11px]">{changeSetId}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">
                        <UserCircleIcon className="w-3.5 h-3.5 text-slate-400" />
                        <span>{author}</span>
                      </div>
                      {first.reason && (
                        <p className="text-xs italic text-slate-600 dark:text-slate-400 mt-1">
                          &ldquo;{first.reason}&rdquo;
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={reverting}
                      onClick={() => handleRevert(changeSetId)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 transition disabled:opacity-50"
                    >
                      <ArrowUturnLeftIcon className="w-3.5 h-3.5" />
                      Geri Al
                    </button>
                  </div>

                  {/* List of changes in this changeSet */}
                  <div className="space-y-1.5 pt-2 border-t border-slate-200/80 dark:border-slate-800">
                    {changeLogs.map((log) => (
                      <div
                        key={log.id}
                        className="text-xs flex items-baseline justify-between gap-2 font-mono"
                      >
                        <span className="text-slate-700 dark:text-slate-300 truncate max-w-xs font-sans font-medium">
                          {log.key}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-red-600 dark:text-red-400 line-through text-[11px]">
                            {log.oldValue !== null ? JSON.stringify(log.oldValue) : '(varsayılan)'}
                          </span>
                          <span className="text-slate-400">→</span>
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
                            {log.newValue !== null ? JSON.stringify(log.newValue) : '(varsayılana dön)'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Pagination */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <span>
              Toplam {total} kayıt (Sayfa {page} / {totalPages})
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => fetchHistory(page - 1)}
                className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
              >
                Önceki
              </button>
              <button
                type="button"
                disabled={page >= totalPages || loading}
                onClick={() => fetchHistory(page + 1)}
                className="px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
              >
                Sonraki
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
