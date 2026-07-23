'use client';

import { StockSourceSelector } from '@/app/t/[tenantPublicId]/warehouses/components/StockSourceSelector';

export default function ErpPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-kp-bg-secondary p-6 rounded-2xl border border-kp-border shadow-xs">
        <StockSourceSelector />
      </div>
    </div>
  );
}
