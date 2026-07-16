'use client';

import { ReactNode } from 'react';

interface PageStubProps {
  title: string;
  description: string;
  icon: ReactNode;
}

export default function PageStub({ title, description, icon }: PageStubProps) {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-semibold text-kp-text-primary">{title}</h1>
        <p className="mt-1 text-[13px] text-kp-text-tertiary">{description}</p>
      </div>

      {/* Coming Soon Card */}
      <div className="card flex flex-col items-center justify-center py-20">
        <div className="flex h-16 w-16 items-center justify-center rounded-kp-xl bg-kp-accent-muted mb-5">
          <div className="h-8 w-8 text-kp-accent">{icon}</div>
        </div>
        <h2 className="text-lg font-semibold text-kp-text-primary mb-2">Coming Soon</h2>
        <p className="max-w-md text-center text-[13px] text-kp-text-tertiary">
          This module is under active development. Check back soon for the full {title.toLowerCase()} experience.
        </p>
        <div className="mt-6 flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-kp-accent animate-pulse-dot" />
          <span className="text-[12px] font-medium text-kp-accent">In Development</span>
        </div>
      </div>
    </div>
  );
}
