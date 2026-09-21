import { EventEmitter } from 'events';

/**
 * Sipariş alan olayları. Aynı kalıp `syncEventEmitter` (integration-queue.service):
 * projede Nest EventEmitter modülü yok, düz Node EventEmitter yetiyor.
 *
 * OrderService transaction'ı BİTTİKTEN sonra yayınlar; dinleyici (bildirim
 * dispatcher'ı) hata verse bile sipariş yazımı geri alınmaz. Dinleyiciler kendi
 * hatalarını yutar — burada `emit` hiçbir zaman istek yoluna hata sızdırmaz.
 */
export interface OrderStatusChangedEvent {
  orderId: string;
  agencyId: string;
  clientId: string | null;
  storeId: string;
  /** 'created' | 'status' | 'payment' | 'cancelled' */
  kind: 'created' | 'status' | 'payment' | 'cancelled';
  oldValue?: string | null;
  newValue: string;
  source?: string;
  suppress?: string[];
}

export const orderEvents = new EventEmitter();
export const ORDER_CHANGED = 'order.changed';

export function emitOrderChanged(event: OrderStatusChangedEvent) {
  try {
    orderEvents.emit(ORDER_CHANGED, event);
  } catch (e) {
    // Bir dinleyici senkron patlarsa: log, ama istek başarılı kalır.
    console.error('[orderEvents] listener failed:', e);
  }
}
