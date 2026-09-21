import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { SparklesIcon, InformationCircleIcon } from '@heroicons/react/24/outline';

interface Props {
  pattern?: string;
  prefix?: string;
  padding?: number;
  resetPeriod?: string;
}

export function OrderNumberPreview({ pattern, prefix, padding, resetPeriod }: Props) {
  const [preview, setPreview] = useState<string>('Yükleniyor...');
  const [currentSeq, setCurrentSeq] = useState<number>(0);
  const [period, setPeriod] = useState<string>('');

  useEffect(() => {
    let active = true;
    const query = new URLSearchParams();
    if (pattern) query.set('pattern', pattern);
    if (prefix !== undefined) query.set('prefix', prefix);
    if (padding !== undefined) query.set('padding', padding.toString());
    if (resetPeriod) query.set('resetPeriod', resetPeriod);

    api
      .get<{ nextNumber: string; currentSequence: number; period: string }>(
        `/api/order-settings/preview/order-number?${query.toString()}`,
      )
      .then((res) => {
        if (active) {
          setPreview(res.nextNumber);
          setCurrentSeq(res.currentSequence);
          setPeriod(res.period);
        }
      })
      .catch(() => {
        // Fallback local preview
        if (active) {
          const now = new Date();
          const yyyy = now.getFullYear().toString();
          const mm = (now.getMonth() + 1).toString().padStart(2, '0');
          const seq = '00001'.slice(-(padding || 5));
          setPreview(`${prefix || 'KP'}-${yyyy}${mm}-${seq}`);
        }
      });

    return () => {
      active = false;
    };
  }, [pattern, prefix, padding, resetPeriod]);

  return (
    <div className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-gradient-to-r from-indigo-50/70 to-blue-50/70 dark:from-indigo-950/20 dark:to-blue-950/20 mb-6">
      <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-300 mb-1">
        <SparklesIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
        <span className="text-xs font-semibold uppercase tracking-wider">
          Canlı Numaralandırma Önizlemesi
        </span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-baseline gap-2 mt-1">
        <span className="text-2xl font-bold font-mono tracking-tight text-slate-900 dark:text-white">
          {preview}
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          (Mevcut Sayaç: <strong className="text-slate-700 dark:text-slate-200">{currentSeq}</strong> · Aktif Dönem:{' '}
          <strong className="text-slate-700 dark:text-slate-200">{period || 'Global'}</strong>)
        </span>
      </div>

      <div className="flex items-center gap-1.5 mt-2.5 text-[11px] text-slate-600 dark:text-slate-400">
        <InformationCircleIcon className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
        <span>
          Kullanılabilir belirteçler:{' '}
          <code className="bg-white/80 dark:bg-slate-900/80 px-1 py-0.5 rounded font-mono">
            {'{PREFIX}'}
          </code>
          ,{' '}
          <code className="bg-white/80 dark:bg-slate-900/80 px-1 py-0.5 rounded font-mono">
            {'{YYYY}'}
          </code>
          ,{' '}
          <code className="bg-white/80 dark:bg-slate-900/80 px-1 py-0.5 rounded font-mono">
            {'{YY}'}
          </code>
          ,{' '}
          <code className="bg-white/80 dark:bg-slate-900/80 px-1 py-0.5 rounded font-mono">
            {'{MM}'}
          </code>
          ,{' '}
          <code className="bg-white/80 dark:bg-slate-900/80 px-1 py-0.5 rounded font-mono">
            {'{DD}'}
          </code>
          ,{' '}
          <code className="bg-white/80 dark:bg-slate-900/80 px-1 py-0.5 rounded font-mono">
            {'{SEQ}'}
          </code>
          ,{' '}
          <code className="bg-white/80 dark:bg-slate-900/80 px-1 py-0.5 rounded font-mono">
            {'{SUFFIX}'}
          </code>
        </span>
      </div>
    </div>
  );
}
