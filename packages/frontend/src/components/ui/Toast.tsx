'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useTranslations } from 'next-intl';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: number;
  variant: ToastVariant;
  message: string;
  duration: number;
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant, duration?: number) => void;
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const MAX_VISIBLE = 4;
const DEFAULT_DURATION = 4000;

const variantConfig: Record<
  ToastVariant,
  {
    Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    iconWrapClass: string;
    accentClass: string;
    role: 'status' | 'alert';
  }
> = {
  success: {
    Icon: CheckCircleIcon,
    iconWrapClass: 'bg-kp-success/15 text-kp-success',
    accentClass: 'bg-kp-success',
    role: 'status',
  },
  error: {
    Icon: XCircleIcon,
    iconWrapClass: 'bg-kp-danger/15 text-kp-danger',
    accentClass: 'bg-kp-danger',
    role: 'alert',
  },
  warning: {
    Icon: ExclamationTriangleIcon,
    iconWrapClass: 'bg-kp-warning/15 text-kp-warning',
    accentClass: 'bg-kp-warning',
    role: 'alert',
  },
  info: {
    Icon: InformationCircleIcon,
    iconWrapClass: 'bg-kp-info/15 text-kp-info',
    accentClass: 'bg-kp-info',
    role: 'status',
  },
};

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: number) => void;
}) {
  const { Icon, iconWrapClass, accentClass, role } = variantConfig[toast.variant];
  const t = useTranslations('common');

  return (
    <div
      role={role}
      className="pointer-events-auto flex w-full items-start gap-3 overflow-hidden rounded-kp-md border border-kp-border bg-kp-bg-secondary shadow-kp-elevated animate-fade-in-up"
    >
      {/* Variant accent rail */}
      <span className={`w-1 self-stretch flex-shrink-0 ${accentClass}`} aria-hidden="true" />

      <div className="flex flex-1 items-start gap-2.5 py-3 pr-2">
        <span
          className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full ${iconWrapClass}`}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
        <p className="flex-1 pt-0.5 text-xs font-medium leading-relaxed text-kp-text-primary break-words">
          {toast.message}
        </p>
      </div>

      <button
        onClick={() => onDismiss(toast.id)}
        aria-label={t('dismissNotification')}
        className="flex-shrink-0 p-3 text-kp-text-tertiary transition-colors hover:text-kp-text-primary"
      >
        <XMarkIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, variant: ToastVariant = 'info', duration = DEFAULT_DURATION) => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, variant, message, duration }].slice(-MAX_VISIBLE));

      const timer = setTimeout(() => {
        timersRef.current.delete(id);
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
      timersRef.current.set(id, timer);
    },
    [],
  );

  // Clear any pending timers on unmount
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      success: (message: string, duration?: number) => toast(message, 'success', duration),
      error: (message: string, duration?: number) => toast(message, 'error', duration),
      warning: (message: string, duration?: number) => toast(message, 'warning', duration),
      info: (message: string, duration?: number) => toast(message, 'info', duration),
      dismiss,
    }),
    [toast, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed bottom-4 right-4 z-[9999] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2 sm:bottom-5 sm:right-5"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast, <ToastProvider> içinde kullanılmalıdır.');
  }
  return ctx;
}
