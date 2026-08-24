'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  ArrowPathIcon,
  ExclamationTriangleIcon,
  NoSymbolIcon,
  PrinterIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import { useTranslations } from 'next-intl';
import StatusBadge from '@/components/ui/StatusBadge';
import { api } from '@/lib/api';
import { labelBlob } from '../labelBlob';
import { badgeType, Shipment } from '../shipmentStatus';

interface ShipmentPackage {
  id: string;
  barcode: string | null;
  weightKg: number | null;
  lengthCm: number | null;
  widthCm: number | null;
  heightCm: number | null;
  desi: number | null;
  chargeableWeightKg: number | null;
  contentDescription: string | null;
}

interface TrackingEvent {
  id: string;
  status: string;
  carrierStatusCode: string | null;
  description: string | null;
  location: string | null;
  occurredAt: string;
}

/** ShipmentService.toDetail — the list fields plus the parcels and timeline. */
export interface ShipmentDetail extends Shipment {
  subCarrier?: string | null;
  serviceLevel: string | null;
  chargeableWeightKg: number | null;
  isTestMode: boolean;
  handedOverAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  carrierCancelledAt: string | null;
  packages: ShipmentPackage[];
  events: TrackingEvent[];
}

interface CarrierLabel {
  format: string;
  content: string;
  /** Deliberately unused: the carrier's own URL is unauthenticated. */
  url?: string;
}

interface CancelResult {
  success: boolean;
  carrierCancelled: boolean;
  message?: string;
}

interface Props {
  shipmentId: string | null;
  onClose: () => void;
  /** Lets the list replace its row without a full reload. */
  onChanged: (shipment: ShipmentDetail) => void;
}

const actionClass =
  'flex items-center gap-2 rounded-kp-md border border-kp-border px-3 py-2 text-xs font-semibold text-kp-text-secondary transition-all hover:bg-kp-bg-hover disabled:cursor-not-allowed disabled:opacity-40';

export default function ShipmentDetailDrawer({ shipmentId, onClose, onChanged }: Props) {
  const t = useTranslations('shipping');
  const [shipment, setShipment] = useState<ShipmentDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [busy, setBusy] = useState<'refresh' | 'label' | 'cancel' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancelNote, setCancelNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!shipmentId) return;
    setIsLoading(true);
    setError(null);
    setCancelNote(null);
    setConfirmingCancel(false);
    try {
      setShipment(await api.get<ShipmentDetail>(`/api/shipments/${shipmentId}`));
    } catch (e: any) {
      setError(e?.message || t('errors.detail'));
      setShipment(null);
    } finally {
      setIsLoading(false);
    }
  }, [shipmentId, t]);

  useEffect(() => {
    load();
  }, [load]);

  if (!shipmentId) return null;

  const refresh = async () => {
    setBusy('refresh');
    setError(null);
    try {
      const updated = await api.post<ShipmentDetail>(`/api/shipments/${shipmentId}/refresh`);
      setShipment(updated);
      onChanged(updated);
    } catch (e: any) {
      setError(e?.message || t('errors.refresh'));
    } finally {
      setBusy(null);
    }
  };

  const printLabel = async () => {
    setBusy('label');
    setError(null);
    try {
      const label = await api.get<CarrierLabel>(`/api/shipments/${shipmentId}/label`, {
        params: { format: 'PDF' },
      });
      // Built from the bytes the API returned. `label.url` is the carrier's own
      // link — usually unauthenticated and enumerable — and is never opened.
      const objectUrl = URL.createObjectURL(labelBlob(label));
      window.open(objectUrl, '_blank', 'noopener');
      // Revoked late: revoking before the new tab has read it yields a blank
      // window in Chrome.
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    } catch (e: any) {
      setError(e?.message || t('errors.label'));
    } finally {
      setBusy(null);
    }
  };

  const cancel = async () => {
    setBusy('cancel');
    setError(null);
    try {
      const result = await api.post<CancelResult>(`/api/shipments/${shipmentId}/cancel`);
      // The half that matters: our side always closes, the carrier's side may
      // not have. Saying only "cancelled" is how a live barcode goes unchased.
      setCancelNote(
        result.carrierCancelled ? t('actions.cancelled') : t('actions.cancelledCarrierLive'),
      );
      setConfirmingCancel(false);
      const updated = await api.get<ShipmentDetail>(`/api/shipments/${shipmentId}`);
      setShipment(updated);
      onChanged(updated);
    } catch (e: any) {
      setError(e?.message || t('errors.cancel'));
    } finally {
      setBusy(null);
    }
  };

  const when = (value: string | null | undefined) =>
    value ? new Date(value).toLocaleString() : '—';

  const rows: [string, string][] = shipment
    ? [
        [t('detail.provider'), shipment.provider],
        ...(shipment.subCarrier ? [[t('detail.subCarrier'), shipment.subCarrier] as [string, string]] : []),
        [t('detail.trackingNumber'), shipment.trackingNumber || '—'],
        [t('detail.barcode'), shipment.barcode || '—'],
        [t('detail.reference'), shipment.referenceCode || '—'],
        [t('detail.serviceLevel'), shipment.serviceLevel || '—'],
        [
          t('detail.paymentType'),
          shipment.paymentType ? t(`paymentType.${shipment.paymentType}`) : '—',
        ],
        [
          t('detail.codAmount'),
          shipment.codAmount != null
            ? `${shipment.codAmount} ${shipment.codCurrency || ''}`.trim()
            : '—',
        ],
        [t('detail.desi'), shipment.totalDesi != null ? String(shipment.totalDesi) : '—'],
        [
          t('detail.weight'),
          shipment.totalWeightKg != null ? `${shipment.totalWeightKg} kg` : '—',
        ],
        [
          t('detail.chargeableWeight'),
          shipment.chargeableWeightKg != null ? `${shipment.chargeableWeightKg} kg` : '—',
        ],
        [t('detail.createdAt'), when(shipment.createdAt)],
        [t('detail.handedOverAt'), when(shipment.handedOverAt)],
        [t('detail.deliveredAt'), when(shipment.deliveredAt)],
        [t('detail.cancelledAt'), when(shipment.cancelledAt)],
      ]
    : [];

  // Filled error with no carrier confirmation: the barcode may still be live.
  const barcodeStillLive = Boolean(shipment?.carrierCancelError && !shipment?.carrierCancelledAt);

  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-2xl flex-col border-l border-kp-border bg-kp-bg-secondary shadow-kp-elevated animate-slide-in-right"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-shrink-0 items-start justify-between border-b border-kp-border bg-kp-bg-primary/40 px-6 py-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-sm font-bold text-kp-text-primary">{t('detail.heading')}</h2>
              {shipment && (
                <StatusBadge
                  status={badgeType(shipment.status)}
                  label={t(`status.${shipment.status}`)}
                />
              )}
              {shipment?.isTestMode && (
                <span className="badge badge--warning">{t('detail.testMode')}</span>
              )}
            </div>
            <p className="mt-1 font-mono text-xs text-kp-text-tertiary">
              {shipment?.barcode || shipment?.trackingNumber || shipment?.publicId || ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            title={t('detail.close')}
            className="rounded-kp-sm p-1.5 text-kp-text-tertiary transition-colors hover:bg-kp-bg-tertiary hover:text-kp-text-primary"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-kp-border px-6 py-3">
          <button type="button" onClick={refresh} disabled={busy !== null} className={actionClass}>
            <ArrowPathIcon className={`h-4 w-4 ${busy === 'refresh' ? 'animate-spin' : ''}`} />
            {t('actions.refresh')}
          </button>
          <button
            type="button"
            onClick={printLabel}
            disabled={busy !== null || !shipment?.trackingNumber}
            title={shipment?.trackingNumber ? undefined : t('actions.labelNeedsBarcode')}
            className={actionClass}
          >
            <PrinterIcon className="h-4 w-4" />
            {t('actions.printLabel')}
          </button>
          {shipment?.status !== 'cancelled' &&
            (confirmingCancel ? (
              <>
                <button
                  type="button"
                  onClick={cancel}
                  disabled={busy !== null}
                  className={`${actionClass} border-kp-danger/50 text-kp-danger`}
                >
                  <NoSymbolIcon className="h-4 w-4" />
                  {t('actions.cancelConfirm')}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingCancel(false)}
                  className={actionClass}
                >
                  {t('actions.cancelAbort')}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmingCancel(true)}
                disabled={busy !== null || !shipment}
                className={actionClass}
              >
                <NoSymbolIcon className="h-4 w-4" />
                {t('actions.cancel')}
              </button>
            ))}
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-4">
          {error && (
            <div className="flex items-center gap-2 rounded-kp-md border border-kp-danger/40 bg-kp-danger-muted px-3.5 py-2 text-theme-sm text-kp-danger">
              <ExclamationTriangleIcon className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {cancelNote && (
            <div
              className={`flex items-start gap-2 rounded-kp-md border px-3.5 py-2 text-theme-sm ${
                barcodeStillLive
                  ? 'border-kp-warning/40 bg-kp-warning-muted text-kp-text-primary'
                  : 'border-kp-border bg-kp-bg-primary/40 text-kp-text-secondary'
              }`}
            >
              {barcodeStillLive && (
                <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-kp-warning" />
              )}
              <span>{cancelNote}</span>
            </div>
          )}

          {/* Stands on its own, not only right after a cancel: a shipment whose
              barcode is still live at the carrier says so every time it opens. */}
          {barcodeStillLive && !cancelNote && (
            <div className="flex items-start gap-2 rounded-kp-md border border-kp-warning/40 bg-kp-warning-muted px-3.5 py-2 text-theme-sm text-kp-text-primary">
              <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-kp-warning" />
              <span>
                {t('actions.cancelledCarrierLive')}
                {shipment?.carrierCancelError ? ` (${shipment.carrierCancelError})` : ''}
              </span>
            </div>
          )}

          {isLoading && (
            <p className="py-8 text-center text-xs text-kp-text-tertiary">{t('detail.loading')}</p>
          )}

          {shipment && (
            <>
              <section>
                <h3 className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-wider text-kp-text-tertiary">
                  {t('detail.identity')}
                </h3>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-theme-sm">
                  {rows.map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-3 border-b border-kp-border/50 py-1">
                      <dt className="text-kp-text-tertiary">{label}</dt>
                      <dd className="text-right font-medium text-kp-text-primary">{value}</dd>
                    </div>
                  ))}
                </dl>
              </section>

              <section>
                <h3 className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-wider text-kp-text-tertiary">
                  {t('detail.packages')}
                </h3>
                <ul className="space-y-1 text-theme-sm text-kp-text-secondary">
                  {shipment.packages.map((parcel, index) => (
                    <li key={parcel.id} className="rounded-kp-md bg-kp-bg-primary/40 px-3 py-2">
                      <span className="font-mono text-xs text-kp-accent">
                        {parcel.barcode || '—'}
                      </span>
                      <span className="ml-2">
                        {t('detail.packageLine', {
                          index: index + 1,
                          weight: parcel.weightKg ?? '—',
                          length: parcel.lengthCm ?? '—',
                          width: parcel.widthCm ?? '—',
                          height: parcel.heightCm ?? '—',
                          desi: parcel.desi ?? '—',
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <h3 className="mb-2 text-[0.6875rem] font-semibold uppercase tracking-wider text-kp-text-tertiary">
                  {t('detail.timeline')}
                </h3>
                {shipment.events.length === 0 ? (
                  <p className="py-4 text-center text-xs text-kp-text-tertiary">
                    {t('detail.noEvents')}
                  </p>
                ) : (
                  <ul className="space-y-0">
                    {shipment.events.map((event, index) => (
                      <li key={event.id} className="relative flex gap-3 pb-4 pl-1">
                        {index < shipment.events.length - 1 && (
                          <span className="absolute left-[0.4375rem] top-3 h-full w-px bg-kp-border" />
                        )}
                        <span className="relative mt-1.5 h-2 w-2 shrink-0 rounded-full bg-kp-accent" />
                        <div className="min-w-0">
                          <p className="text-theme-sm font-medium text-kp-text-primary">
                            {t(`status.${event.status}`)}
                            {event.location ? ` · ${event.location}` : ''}
                          </p>
                          {event.description && (
                            <p className="text-xs text-kp-text-secondary">{event.description}</p>
                          )}
                          <p className="text-[0.6875rem] text-kp-text-tertiary">
                            {when(event.occurredAt)}
                            {event.carrierStatusCode ? ` · ${event.carrierStatusCode}` : ''}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
