import React from 'react';
import { ArrowPathIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface Props {
  changeCount: number;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
}

export function DirtyActionBar({ changeCount, saving, onSave, onDiscard }: Props) {
  if (changeCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-xl w-full px-4 animate-in fade-in slide-in-from-bottom-4 duration-200">
      <div className="bg-slate-900 dark:bg-slate-800 text-white shadow-2xl rounded-2xl p-3.5 border border-slate-700/80 flex items-center justify-between gap-4 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse"></span>
          <span className="text-sm font-medium">
            <strong className="text-amber-400">{changeCount}</strong> ayar değiştirildi (kaydedilmedi)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={onDiscard}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 dark:hover:bg-slate-700 transition disabled:opacity-50"
          >
            <XMarkIcon className="w-4 h-4" />
            Vazgeç
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={onSave}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md transition disabled:opacity-50"
          >
            {saving ? (
              <>
                <ArrowPathIcon className="w-4 h-4 animate-spin" />
                Kaydediliyor...
              </>
            ) : (
              <>
                <CheckIcon className="w-4 h-4" />
                Kaydet
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
