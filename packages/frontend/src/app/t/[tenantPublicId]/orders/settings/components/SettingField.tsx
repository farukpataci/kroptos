import React, { useState } from 'react';
import { EffectiveSettingValue } from '../types';
import { InheritanceBadge } from './InheritanceBadge';
import { XMarkIcon, PlusIcon } from '@heroicons/react/24/outline';

interface Props {
  setting: EffectiveSettingValue;
  draftValue: any;
  isDirty: boolean;
  onUpdate: (value: any) => void;
  onReset: () => void;
  onToggleLock: (locked: boolean) => void;
  canLock?: boolean;
  allSettingsMap: Map<string, any>;
}

export function SettingField({
  setting,
  draftValue,
  isDirty,
  onUpdate,
  onReset,
  onToggleLock,
  canLock,
  allSettingsMap,
}: Props) {
  const { definition, sourceLevel, inheritedValue, isOverridden, isLocked, lockedAtLevel, canEdit } =
    setting;

  const [isEditing, setIsEditing] = useState(isOverridden || isDirty);
  const [newTagInput, setNewTagInput] = useState('');

  // Evaluate dependsOn condition
  if (definition.dependsOn) {
    const parentVal = allSettingsMap.get(definition.dependsOn.key);
    const requiredVal = definition.dependsOn.value;
    const isSatisfied =
      requiredVal !== undefined ? parentVal === requiredVal : Boolean(parentVal);
    if (!isSatisfied) {
      return null; // hide dependent field if parent condition is not met
    }
  }

  const currentValue = draftValue !== undefined ? draftValue : setting.value;
  const disabled = !canEdit || (isLocked && sourceLevel !== 'STORE');

  const handleCustomize = () => {
    setIsEditing(true);
    onUpdate(currentValue);
  };

  const handleReset = () => {
    setIsEditing(false);
    onReset();
  };

  const renderInput = () => {
    switch (definition.type) {
      case 'boolean':
        return (
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              disabled={disabled}
              checked={Boolean(currentValue)}
              onChange={(e) => {
                setIsEditing(true);
                onUpdate(e.target.checked);
              }}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-indigo-600"></div>
            <span className="ml-3 text-xs font-medium text-slate-700 dark:text-slate-300">
              {currentValue ? 'Aktif / Açık' : 'Pasif / Kapalı'}
            </span>
          </label>
        );

      case 'enum':
        return (
          <select
            disabled={disabled}
            value={currentValue ?? ''}
            onChange={(e) => {
              setIsEditing(true);
              onUpdate(e.target.value);
            }}
            className="w-full max-w-md px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:opacity-50"
          >
            {definition.validation?.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );

      case 'int':
      case 'decimal':
      case 'money':
        return (
          <div className="relative max-w-xs flex items-center">
            <input
              type="number"
              disabled={disabled}
              value={currentValue ?? ''}
              min={definition.validation?.min}
              max={definition.validation?.max}
              step={definition.type === 'int' ? 1 : 0.01}
              onChange={(e) => {
                setIsEditing(true);
                const val = definition.type === 'int' ? parseInt(e.target.value, 10) : parseFloat(e.target.value);
                onUpdate(isNaN(val) ? '' : val);
              }}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:opacity-50"
            />
            {definition.unit && (
              <span className="ml-2 text-xs text-slate-500 dark:text-slate-400 font-medium whitespace-nowrap">
                {definition.unit}
              </span>
            )}
          </div>
        );

      case 'time':
        return (
          <input
            type="time"
            disabled={disabled}
            value={currentValue ?? '16:00'}
            onChange={(e) => {
              setIsEditing(true);
              onUpdate(e.target.value);
            }}
            className="w-36 px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:opacity-50"
          />
        );

      case 'tags': {
        const tags: string[] = Array.isArray(currentValue) ? currentValue : [];
        const handleAddTag = () => {
          if (!newTagInput.trim()) return;
          setIsEditing(true);
          onUpdate([...tags, newTagInput.trim()]);
          setNewTagInput('');
        };
        const handleRemoveTag = (idx: number) => {
          setIsEditing(true);
          onUpdate(tags.filter((_, i) => i !== idx));
        };

        return (
          <div className="space-y-2 max-w-xl">
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                >
                  {tag}
                  {!disabled && (
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(idx)}
                      className="text-slate-400 hover:text-red-500"
                    >
                      <XMarkIcon className="w-3 h-3" />
                    </button>
                  )}
                </span>
              ))}
              {tags.length === 0 && (
                <span className="text-xs text-slate-400 italic">Kayıtlı öğe yok</span>
              )}
            </div>
            {!disabled && (
              <div className="flex gap-2 max-w-sm">
                <input
                  type="text"
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  placeholder="Yeni ekle..."
                  className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition"
                >
                  <PlusIcon className="w-3.5 h-3.5" />
                  Ekle
                </button>
              </div>
            )}
          </div>
        );
      }

      case 'string':
      default:
        if (definition.validation?.options) {
          return (
            <select
              disabled={disabled}
              value={currentValue ?? ''}
              onChange={(e) => {
                setIsEditing(true);
                onUpdate(e.target.value);
              }}
              className="w-full max-w-md px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:opacity-50"
            >
              {definition.validation.options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          );
        }
        return (
          <input
            type="text"
            disabled={disabled}
            value={currentValue ?? ''}
            onChange={(e) => {
              setIsEditing(true);
              onUpdate(e.target.value);
            }}
            className="w-full max-w-md px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none disabled:opacity-50"
          />
        );
    }
  };

  return (
    <div
      className={`p-4 rounded-xl border transition-colors ${
        isDirty
          ? 'border-amber-400/80 bg-amber-50/20 dark:bg-amber-950/10'
          : 'border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/40 hover:border-slate-300 dark:hover:border-slate-700'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-slate-900 dark:text-white">
              {definition.key.split('.').slice(-1)[0]}
            </span>
            <code className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-mono">
              {definition.key}
            </code>
            {isDirty && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                Değiştirildi
              </span>
            )}
            {definition.sensitive && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 border border-red-200 dark:border-red-900/50">
                Hassas
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {definition.descriptionKey}
          </p>
        </div>

        <InheritanceBadge
          sourceLevel={sourceLevel}
          inheritedValue={inheritedValue}
          isOverridden={isOverridden}
          isLocked={isLocked}
          lockedAtLevel={lockedAtLevel}
          canEdit={canEdit}
          isEditing={isEditing}
          onCustomize={handleCustomize}
          onReset={handleReset}
          onToggleLock={onToggleLock}
          canLock={canLock}
        />
      </div>

      <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800/60">
        {renderInput()}
      </div>
    </div>
  );
}
