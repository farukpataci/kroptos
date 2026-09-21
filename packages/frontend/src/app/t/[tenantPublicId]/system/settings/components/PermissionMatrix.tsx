'use client';

import { CheckIcon } from '@heroicons/react/24/outline';
import type { PermissionGroup } from '../hooks/useRoles';

interface Props {
  groups: PermissionGroup[];
  granted: string[];
  readOnly: boolean;
  onToggle: (key: string) => void;
}

/** Kategori gruplu izin matrisi; kategori ve adlar shared katalogundan (API uzerinden). */
export default function PermissionMatrix({ groups, granted, readOnly, onToggle }: Props) {
  return (
    <div className="space-y-5">
      {groups.map((group, idx) => (
        <div key={group.category} className={`${idx > 0 ? 'pt-5 border-t border-kp-border/50' : ''} space-y-3`}>
          <h4 className="text-[0.6875rem] font-bold text-kp-text-primary uppercase tracking-wider">{group.category}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {group.permissions.map((perm) => {
              const on = granted.includes(perm.key);
              return (
                <label
                  key={perm.key}
                  className={`flex items-start gap-3 p-3 rounded-kp-md border transition-all ${readOnly ? 'cursor-default opacity-80' : 'cursor-pointer'} ${on ? 'bg-kp-accent/5 border-kp-accent/30' : 'bg-kp-bg-primary border-kp-border hover:border-kp-border-hover'}`}
                >
                  <input type="checkbox" checked={on} disabled={readOnly} onChange={() => onToggle(perm.key)} className="mt-0.5 h-4 w-4 rounded border-kp-border text-kp-accent focus:ring-kp-accent disabled:opacity-60" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-kp-text-primary">
                      {perm.name}
                      {on && <CheckIcon className="h-3 w-3 text-kp-accent" />}
                    </div>
                    <div className="text-[0.625rem] text-kp-text-tertiary leading-relaxed">{perm.description}</div>
                    <div className="text-[0.5625rem] font-mono text-kp-text-tertiary/70">{perm.key}</div>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
