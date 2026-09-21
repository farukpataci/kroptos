import React from 'react';
import { SettingSection } from '../types';
import {
  Cog6ToothIcon,
  NumberedListIcon,
  ArrowPathIcon,
  CubeIcon,
  BanknotesIcon,
  TruckIcon,
  DocumentTextIcon,
  ArrowUturnLeftIcon,
  ShieldExclamationIcon,
  UserIcon,
  ClockIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';

const ICON_MAP: Record<string, any> = {
  Cog6ToothIcon,
  NumberedListIcon,
  ArrowPathIcon,
  CubeIcon,
  BanknotesIcon,
  TruckIcon,
  DocumentTextIcon,
  ArrowUturnLeftIcon,
  ShieldExclamationIcon,
  UserIcon,
  ClockIcon,
};

interface Props {
  sections: SettingSection[];
  activeSectionId: string;
  onSelectSection: (id: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  scopeLabel: string;
}

export function OrderSettingsSidebar({
  sections,
  activeSectionId,
  onSelectSection,
  searchQuery,
  onSearchChange,
  scopeLabel,
}: Props) {
  return (
    <aside className="w-full lg:w-64 shrink-0 space-y-4">
      {/* Active Scope Banner */}
      <div className="p-3 rounded-xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-950/20">
        <span className="text-[10px] uppercase font-bold text-indigo-700 dark:text-indigo-400 tracking-wider block">
          Etki Kapsamı
        </span>
        <span className="text-xs font-semibold text-slate-900 dark:text-white mt-0.5 block">
          {scopeLabel}
        </span>
      </div>

      {/* Search Input */}
      <div className="relative">
        <MagnifyingGlassIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Ayarlarda ara..."
          className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-none transition shadow-sm"
        />
      </div>

      {/* Mobile Section Picker Dropdown */}
      <div className="lg:hidden">
        <select
          value={activeSectionId}
          onChange={(e) => onSelectSection(e.target.value)}
          className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none"
        >
          {sections.map((sec) => (
            <option key={sec.id} value={sec.id}>
              {sec.label}
            </option>
          ))}
        </select>
      </div>

      {/* Desktop Section Navigation List */}
      <nav className="hidden lg:block space-y-0.5">
        {sections.map((sec) => {
          const Icon = ICON_MAP[sec.icon] || Cog6ToothIcon;
          const isActive = activeSectionId === sec.id && !searchQuery;

          return (
            <button
              key={sec.id}
              type="button"
              onClick={() => {
                onSelectSection(sec.id);
                onSearchChange('');
              }}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition text-left ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-200 dark:shadow-none'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              <span className="truncate">{sec.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
