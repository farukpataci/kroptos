'use client';

import React from 'react';
import {
  BookmarkSquareIcon,
  TrashIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { useImportMappings } from '../hooks/useImportMappings';

export function ImportMappingsTab() {
  const { templates, isLoading, deleteTemplate } = useImportMappings();

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Kayıtlı Eşleştirme Şablonları
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Tekrarlayan dosya yüklemeleri için önceden kaydedilmiş kolon ve değer eşleme ayarları.
          </p>
        </div>

        <span className="text-xs text-slate-500">
          Toplam <b>{templates.length}</b> şablon
        </span>
      </div>

      {isLoading ? (
        <div className="py-12 flex items-center justify-center gap-2 text-slate-500 text-sm">
          <ArrowPathIcon className="h-5 w-5 animate-spin text-indigo-500" />
          Şablonlar yükleniyor...
        </div>
      ) : templates.length === 0 ? (
        <div className="py-12 text-center text-slate-500 dark:text-slate-400 text-sm">
          Henüz kayıtlı bir eşleştirme şablonu bulunmuyor. Yeni bir içe aktarma yaparken sonuç ekranında &quot;Şablon Olarak Kaydet&quot; butonunu kullanabilirsiniz.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((tpl) => {
            const mappedCount = tpl.columnMap ? Object.keys(tpl.columnMap).length : 0;

            return (
              <div
                key={tpl.id}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 hover:border-slate-300 dark:hover:border-slate-700 transition space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <BookmarkSquareIcon className="h-5 w-5 text-indigo-500 shrink-0" />
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        {tpl.name}
                      </h4>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {new Date(tpl.updatedAt).toLocaleDateString('tr-TR')}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => deleteTemplate(tpl.id)}
                    className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition"
                    title="Şablonu Sil"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
                  <div className="flex justify-between">
                    <span>İçe Aktarma Modu:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">{tpl.mode}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Eşleşme Anahtarı:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">{tpl.matchKey}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Eşleşen Kolon:</span>
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400">{mappedCount} sütun</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
