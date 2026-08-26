'use client';

import { useTranslations } from 'next-intl';
import { PhotoIcon, AdjustmentsHorizontalIcon } from '@heroicons/react/24/outline';
import { StockRow, isCritical, isOutOfStock } from '../hooks/useProductStock';

interface StockTableProps {
  rows: StockRow[];
  isLoading: boolean;
  selectedIds: string[];
  onToggleSelect: (productId: string) => void;
  onToggleSelectAll: () => void;
  onAdjust: (row: StockRow) => void;
}

function StockLevelBadge({ row, label }: { row: StockRow; label: (k: string) => string }) {
  if (isOutOfStock(row)) return <span className="badge badge--danger">{label('out')}</span>;
  if (isCritical(row)) return <span className="badge badge--warning">{label('critical')}</span>;
  return <span className="badge badge--success">{label('healthy')}</span>;
}

export default function StockTable({
  rows,
  isLoading,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onAdjust,
}: StockTableProps) {
  const t = useTranslations('productStock');
  const allSelected = rows.length > 0 && rows.every((r) => selectedIds.includes(r.productId));

  if (isLoading) {
    return (
      <div className="card flex min-h-[280px] items-center justify-center p-8">
        <p className="text-xs text-kp-text-tertiary">{t('empty.loading')}</p>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="card flex min-h-[280px] flex-col items-center justify-center gap-2 p-8 text-center">
        <p className="text-sm font-semibold text-kp-text-primary">{t('empty.title')}</p>
        <p className="max-w-sm text-xs text-kp-text-tertiary">{t('empty.desc')}</p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="kp-table w-full">
          <thead>
            <tr>
              <th className="w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onToggleSelectAll}
                  aria-label={t('actions.selectAll')}
                  className="h-3.5 w-3.5 rounded border-kp-border accent-kp-accent"
                />
              </th>
              <th className="w-14">{t('columns.image')}</th>
              <th>{t('columns.name')}</th>
              <th>{t('columns.sku')}</th>
              <th>{t('columns.barcode')}</th>
              <th className="text-right">{t('columns.total')}</th>
              <th className="text-right">{t('columns.reserved')}</th>
              <th className="text-right">{t('columns.available')}</th>
              <th className="text-right">{t('columns.reorderLevel')}</th>
              <th>{t('columns.updatedAt')}</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.inventoryId}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(row.productId)}
                    onChange={() => onToggleSelect(row.productId)}
                    aria-label={row.name}
                    className="h-3.5 w-3.5 rounded border-kp-border accent-kp-accent"
                  />
                </td>
                <td>
                  {row.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={row.image}
                      alt=""
                      className="h-8 w-8 rounded-kp-sm border border-kp-border object-cover"
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-kp-sm border border-kp-border bg-kp-bg-primary/40">
                      <PhotoIcon className="h-4 w-4 text-kp-text-tertiary" />
                    </div>
                  )}
                </td>
                <td>
                  <div className="flex flex-col gap-1">
                    <span className="font-medium text-kp-text-primary">{row.name}</span>
                    <StockLevelBadge row={row} label={(k) => t(`level.${k}`)} />
                  </div>
                </td>
                <td className="font-mono text-kp-text-secondary">{row.sku}</td>
                <td className="font-mono text-kp-text-tertiary">{row.barcode || '—'}</td>
                <td className="text-right font-semibold text-kp-text-primary">{row.totalQty}</td>
                <td className="text-right text-kp-text-secondary">{row.reservedQty}</td>
                <td className="text-right text-kp-text-secondary">{row.availableQty}</td>
                <td className="text-right text-kp-text-tertiary">{row.reorderLevel}</td>
                <td className="text-kp-text-tertiary">
                  {row.updatedAt ? new Date(row.updatedAt).toLocaleString() : '—'}
                </td>
                <td>
                  <button
                    type="button"
                    onClick={() => onAdjust(row)}
                    title={t('actions.adjust')}
                    aria-label={t('actions.adjust')}
                    className="rounded-kp-md border border-kp-border p-1.5 text-kp-text-secondary transition-all hover:bg-kp-bg-hover hover:text-kp-accent"
                  >
                    <AdjustmentsHorizontalIcon className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
