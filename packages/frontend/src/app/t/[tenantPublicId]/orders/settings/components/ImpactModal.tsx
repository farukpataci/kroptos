import React, { useState } from 'react';
import { SettingImpact } from '../types';
import {
  ExclamationTriangleIcon,
  ShieldExclamationIcon,
  ArrowPathIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';

interface Props {
  isOpen: boolean;
  impact: SettingImpact | null;
  saving: boolean;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

export function ImpactModal({ isOpen, impact, saving, onConfirm, onCancel }: Props) {
  const [reason, setReason] = useState('');

  if (!isOpen || !impact) return null;

  const isHighRisk = impact.riskLevel === 'HIGH' || impact.riskLevel === 'MEDIUM';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-start gap-3.5">
          <div
            className={`p-2.5 rounded-xl ${
              isHighRisk
                ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
                : 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400'
            }`}
          >
            {isHighRisk ? (
              <ExclamationTriangleIcon className="w-6 h-6" />
            ) : (
              <ShieldExclamationIcon className="w-6 h-6" />
            )}
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Değişiklik Etki Analizi
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Yapılan ayar değişikliklerinin mevcut operasyona ve açık siparişlere etkisi aşağıda özetlenmiştir.
            </p>
          </div>
        </div>

        {/* Impact List */}
        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
          {impact.summary.length === 0 ? (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 text-xs">
              <CheckCircleIcon className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Kritik bir etki bulunamadı. Değişiklikler güvenle uygulanabilir.</span>
            </div>
          ) : (
            impact.summary.map((item, idx) => (
              <div
                key={idx}
                className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-xs space-y-1"
              >
                <div className="flex items-center justify-between font-semibold text-slate-900 dark:text-white">
                  <span>{item.label}</span>
                  {item.count !== undefined && item.count > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 text-[11px]">
                      {item.count} Sipariş
                    </span>
                  )}
                </div>
                <p className="text-slate-600 dark:text-slate-400 leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))
          )}
        </div>

        {/* Change Reason Note */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
            Değişiklik Nedeni (Opsiyonel / Denetim Kaydı)
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Örn: Yılbaşı kampanya hazırlığı nedeniyle kargo limitleri güncellendi"
            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          />
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            disabled={saving}
            onClick={onCancel}
            className="px-4 py-2 text-xs font-semibold rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-50"
          >
            İncelemeye Dön
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => onConfirm(reason)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow transition disabled:opacity-50"
          >
            {saving ? (
              <>
                <ArrowPathIcon className="w-4 h-4 animate-spin" />
                Uygulanıyor...
              </>
            ) : (
              'Onayla ve Kaydet'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
