'use client';

import { useState } from 'react';
import { XMarkIcon } from '@heroicons/react/20/solid';

import { useTranslations } from 'next-intl';

interface AnnouncementBarProps {
  onClose?: () => void;
}

export default function AnnouncementBar({ onClose }: AnnouncementBarProps) {
  const [isVisible, setIsVisible] = useState(true);
  const t = useTranslations('marketing.announcement');

  const handleClose = () => {
    setIsVisible(false);
    if (onClose) {
      onClose();
    }
  };

  if (!isVisible) return null;

  return (
    <div className="relative z-[60] bg-gradient-to-r from-slate-950 via-[#0a0f24] to-slate-950 border-b border-white/5 py-2 px-4 transition-all duration-300">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs sm:text-sm font-medium text-white tracking-wide text-center">
            {t.rich('message', {
              brand: (chunks) => <span className="font-semibold text-kp-accent">{chunks}</span>,
            })}
          </p>
        </div>
        <button
          onClick={handleClose}
          type="button"
          className="inline-flex rounded-kp-sm p-1 text-slate-400 hover:text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white transition-all ml-4"
          aria-label={t('close')}
        >
          <XMarkIcon className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
