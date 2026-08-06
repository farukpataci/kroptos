'use client';

import { ReactNode } from 'react';
import Link from 'next/link';

interface KpiCardProps {
  title: string;
  value: string | number;
  trend?: string;
  trendDirection?: 'up' | 'down' | 'neutral';
  icon: ReactNode;
  color?: 'accent' | 'success' | 'warning' | 'danger' | 'info';
  href?: string;
}

const colorMap = {
  accent: {
    iconBg: 'bg-kp-accent-muted',
    iconText: 'text-kp-accent',
  },
  success: {
    iconBg: 'bg-kp-success-muted',
    iconText: 'text-kp-success',
  },
  warning: {
    iconBg: 'bg-kp-warning-muted',
    iconText: 'text-kp-warning',
  },
  danger: {
    iconBg: 'bg-kp-danger-muted',
    iconText: 'text-kp-danger',
  },
  info: {
    iconBg: 'bg-kp-info-muted',
    iconText: 'text-kp-info',
  },
};

export default function KpiCard({
  title,
  value,
  trend,
  trendDirection = 'neutral',
  icon,
  color = 'accent',
  href,
}: KpiCardProps) {
  const colors = colorMap[color];

  const content = (
    <div className={`card card-interactive group transition-all duration-200 block ${href ? 'cursor-pointer hover:border-kp-accent hover:shadow-kp-elevated' : 'cursor-default'}`}>
      <div className="flex items-start justify-between">
        <div className="space-y-3">
          <p className="text-[0.75rem] font-medium uppercase tracking-wider text-kp-text-tertiary">
            {title}
          </p>
          <p className="text-[1.75rem] font-bold leading-none tracking-tight text-kp-text-primary">
            {value}
          </p>
          {trend && (
            <div className="flex items-center gap-1.5">
              <span
                className={`text-[0.75rem] font-semibold ${
                  trendDirection === 'up'
                    ? 'text-kp-success'
                    : trendDirection === 'down'
                    ? 'text-kp-danger'
                    : 'text-kp-text-tertiary'
                }`}
              >
                {trendDirection === 'up' ? '↑' : trendDirection === 'down' ? '↓' : '→'} {trend}
              </span>
              <span className="text-[0.6875rem] text-kp-text-tertiary">vs yesterday</span>
            </div>
          )}
        </div>

        <div className={`flex h-10 w-10 items-center justify-center rounded-kp-md ${colors.iconBg} transition-transform group-hover:scale-110`}>
          <div className={`h-5 w-5 ${colors.iconText}`}>{icon}</div>
        </div>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block no-underline">
        {content}
      </Link>
    );
  }

  return content;
}
