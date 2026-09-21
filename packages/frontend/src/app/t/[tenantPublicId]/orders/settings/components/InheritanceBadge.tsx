import React from 'react';
import { LockClosedIcon, ArrowUturnLeftIcon, PencilSquareIcon } from '@heroicons/react/24/outline';
import { EffectiveSourceLevel, ScopeLevel } from '../types';

interface Props {
  sourceLevel: EffectiveSourceLevel;
  inheritedValue: any;
  isOverridden: boolean;
  isLocked: boolean;
  lockedAtLevel?: ScopeLevel;
  canEdit: boolean;
  isEditing: boolean;
  onCustomize: () => void;
  onReset: () => void;
  onToggleLock?: (locked: boolean) => void;
  canLock?: boolean;
}

export function InheritanceBadge({
  sourceLevel,
  inheritedValue,
  isOverridden,
  isLocked,
  lockedAtLevel,
  canEdit,
  isEditing,
  onCustomize,
  onReset,
  onToggleLock,
  canLock = false,
}: Props) {
  const getBadgeDetails = () => {
    switch (sourceLevel) {
      case 'STORE':
        return {
          label: 'Bu Mağazada Özel',
          bg: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60',
        };
      case 'CLIENT':
        return {
          label: 'Markadan Miras',
          bg: 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800/60',
        };
      case 'AGENCY':
        return {
          label: 'Firmadan Miras',
          bg: 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200 dark:border-purple-800/60',
        };
      case 'SYSTEM':
      default:
        return {
          label: 'Sistem Varsayılanı',
          bg: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
        };
    }
  };

  const badge = getBadgeDetails();

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {/* Source Level Badge */}
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${badge.bg}`}
      >
        {badge.label}
      </span>

      {/* Lock Badge */}
      {isLocked && (
        <span
          title={`${lockedAtLevel || 'Üst'} seviyesinde kilitlendi. Alt seviyeler değiştiremez.`}
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60"
        >
          <LockClosedIcon className="w-3 h-3 text-amber-600 dark:text-amber-400" />
          Kilitli ({lockedAtLevel || 'Üst'})
        </span>
      )}

      {/* Reset to Inherited Value */}
      {isOverridden && canEdit && (
        <button
          type="button"
          onClick={onReset}
          title={`Üst seviye değerine dön: ${JSON.stringify(inheritedValue)}`}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 px-1.5 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition"
        >
          <ArrowUturnLeftIcon className="w-3 h-3" />
          Varsayılana Dön
        </button>
      )}

      {/* Customize Button if Inherited */}
      {!isOverridden && !isEditing && canEdit && (
        <button
          type="button"
          onClick={onCustomize}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 px-1.5 py-0.5 rounded hover:bg-indigo-50 dark:hover:bg-indigo-950/50 transition"
        >
          <PencilSquareIcon className="w-3 h-3" />
          Özelleştir
        </button>
      )}

      {/* Lock/Unlock Toggle for Agency/Client users */}
      {canLock && onToggleLock && (
        <button
          type="button"
          onClick={() => onToggleLock(!isLocked)}
          className={`text-[11px] px-1.5 py-0.5 rounded border transition font-medium ${
            isLocked
              ? 'border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-950/50'
              : 'border-slate-200 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'
          }`}
        >
          {isLocked ? 'Kilidi Kaldır' : 'Alt Seviyeler İçin Kilitle'}
        </button>
      )}
    </div>
  );
}
