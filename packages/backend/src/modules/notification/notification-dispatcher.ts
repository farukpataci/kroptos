import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { NotificationChannel, NotificationEvent } from '@prisma/client';
import { PrismaService } from '@common/prisma/prisma.service';
import { runWithTenant } from '@common/prisma/tenant-context';
import { ORDER_CHANGED, orderEvents, OrderStatusChangedEvent } from '../order/order.events';
import { NotificationService } from './notification.service';

/** Sistem sipariş durumu → bildirim olayı. Listede olmayan durum özel durumdur (ORDER_STATUS_CHANGED). */
const STATUS_EVENTS: Record<string, NotificationEvent> = {
  processing: 'ORDER_CONFIRMED',
  shipped: 'ORDER_SHIPPED',
  out_for_delivery: 'ORDER_OUT_FOR_DELIVERY',
  delivered: 'ORDER_DELIVERED',
  cancelled: 'ORDER_CANCELLED',
};
const PAYMENT_EVENTS: Record<string, NotificationEvent> = {
  paid: 'PAYMENT_RECEIVED',
  failed: 'PAYMENT_FAILED',
};
const SYSTEM_STATUSES = new Set(['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'out_for_delivery']);

/**
 * `orderEvents` dinleyicisi: olayı bildirim olayına çevirir, kanal başına efektif
 * şablonu çözer, müşterinin dilinde (mağaza locale'i) kuyruğa atar. Şablon pasifse
 * SKIPPED log yazar. Her adım kiracı bağlamında (RLS).
 */
@Injectable()
export class NotificationDispatcher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationDispatcher.name);
  private readonly handler = (e: OrderStatusChangedEvent) => {
    this.handle(e).catch((err) => this.logger.error(`dispatch failed for order ${e.orderId}: ${err.message}`));
  };

  constructor(private readonly prisma: PrismaService, private readonly notifications: NotificationService) {}

  onModuleInit() {
    orderEvents.on(ORDER_CHANGED, this.handler);
  }
  onModuleDestroy() {
    orderEvents.off(ORDER_CHANGED, this.handler);
  }

  static eventFor(e: OrderStatusChangedEvent): { event: NotificationEvent; orderStatusKey: string } | null {
    if (e.kind === 'created') return { event: 'ORDER_CREATED', orderStatusKey: '' };
    if (e.kind === 'cancelled') return { event: 'ORDER_CANCELLED', orderStatusKey: '' };
    if (e.kind === 'payment') {
      const ev = PAYMENT_EVENTS[e.newValue];
      return ev ? { event: ev, orderStatusKey: '' } : null;
    }
    const ev = STATUS_EVENTS[e.newValue];
    if (ev) return { event: ev, orderStatusKey: '' };
    if (!SYSTEM_STATUSES.has(e.newValue)) return { event: 'ORDER_STATUS_CHANGED', orderStatusKey: e.newValue };
    return null; // pending'e dönüş vb.
  }

  async handle(e: OrderStatusChangedEvent) {
    const mapped = NotificationDispatcher.eventFor(e);
    if (!mapped) return;
    await runWithTenant(e.agencyId, async () => {
      const order = await this.prisma.order.findFirst({ where: { id: e.orderId, deletedAt: null } });
      if (!order) return;
      const scope = { agencyId: order.agencyId, clientId: order.clientId, storeId: order.storeId };
      const locale = await this.notifications.localeFor(order.storeId);
      const context = await this.notifications.buildContext(order.id, mapped.event);
      if (!context) return;

      for (const channel of ['EMAIL', 'SMS'] as NotificationChannel[]) {
        const recipient = this.notifications.recipientFor(order, channel);
        if (!recipient) continue;
        // Özel durum: önce o duruma özel şablon, yoksa genel ORDER_STATUS_CHANGED.
        let template = await this.notifications.resolve(scope, channel, mapped.event, locale, mapped.orderStatusKey, false);
        if (!template && mapped.orderStatusKey) template = await this.notifications.resolve(scope, channel, mapped.event, locale, '', false);
        if (!template) continue;
        if ('isActive' in template && template.isActive === false) {
          await this.prisma.notificationLog.create({
            data: {
              agencyId: scope.agencyId, clientId: scope.clientId, storeId: scope.storeId,
              templateId: template.id, channel, event: mapped.event, orderId: order.id,
              recipient: recipient.includes('@') ? recipient.replace(/^(.).*@/, '$1***@') : '***',
              renderedBody: '', status: 'SKIPPED', provider: 'none', errorMessage: 'Template inactive',
            },
          });
          continue;
        }
        await this.notifications.enqueue({
          scope, template, recipient, context, orderId: order.id,
          delayMinutes: 'sendDelayMinutes' in template ? template.sendDelayMinutes : 0,
        });
      }
    });
  }
}
