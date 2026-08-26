'use client';

import { ArrowPathIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';

interface SubPageShellProps {
  title: string;
  subtitle: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  /** Shown, never swallowed: a 403 here means the role lacks the permission,
   *  and an empty table would read as "nothing here" instead of "not yours". */
  error?: string | null;
  onReload?: () => void;
  isLoading?: boolean;
  reloadLabel?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

/** The header, error banner and page frame every Orders sub-page repeats. */
export function SubPageShell({
  title,
  subtitle,
  icon: Icon,
  error,
  onReload,
  isLoading,
  reloadLabel,
  actions,
  children,
}: SubPageShellProps) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 border-b border-kp-border pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-kp-md bg-kp-accent/10 text-kp-accent">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="page-title">{title}</h1>
            <p className="page-subtitle">{subtitle}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {actions}
          {onReload && (
            <button
              type="button"
              onClick={onReload}
              disabled={isLoading}
              className="flex items-center gap-2 rounded-kp-md border border-kp-border px-3 py-2 text-xs font-semibold text-kp-text-secondary transition-all hover:bg-kp-bg-hover disabled:opacity-40"
            >
              <ArrowPathIcon className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              {reloadLabel}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-kp-md border border-kp-danger/40 bg-kp-danger-muted px-3.5 py-2 text-theme-sm text-kp-danger">
          <ExclamationTriangleIcon className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {children}
    </div>
  );
}

/**
 * The body for a sub-page whose backend does not exist yet. Deliberately not a
 * mocked table: a page full of invented rows is indistinguishable from a
 * working feature, and someone eventually ships against it.
 */
export function NotBuiltYet({ message }: { message: string }) {
  return (
    <div className="card flex min-h-[320px] items-center justify-center p-8">
      <p className="max-w-md text-center text-xs text-kp-text-tertiary">{message}</p>
    </div>
  );
}
