'use client';

import { ReactNode } from 'react';

interface QuickActionCardProps {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
}

export default function QuickActionCard({ icon, label, onClick }: QuickActionCardProps) {
  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-3 rounded-kp-lg border border-kp-border bg-kp-bg-secondary px-5 py-4 text-left transition-all duration-200 hover:border-kp-border-accent hover:shadow-kp-glow active:scale-[0.98]"
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-kp-md bg-kp-accent-muted transition-colors group-hover:bg-kp-accent">
        <div className="h-[18px] w-[18px] text-kp-accent group-hover:text-white transition-colors">
          {icon}
        </div>
      </div>
      <span className="text-[0.8125rem] font-medium text-kp-text-secondary group-hover:text-kp-text-primary transition-colors">
        {label}
      </span>
    </button>
  );
}
