import { Injectable } from '@nestjs/common';
import { ActionType, DryRunStepResult } from '../automation-types';
import { ActionContext, ActionHandler } from './action-handler.interface';
import { OrderService } from '../../order/order.service';

@Injectable()
export class SetOrderStatusHandler implements ActionHandler {
  readonly type: ActionType = 'SET_ORDER_STATUS';

  constructor(private readonly orderService: OrderService) {}

  validateConfig(config: any) {
    if (!config || (!config.status && !config.paymentStatus && !config.fulfillmentStatus)) {
      return { isValid: false, error: 'En az bir durum (status, paymentStatus, fulfillmentStatus) belirtilmelidir.' };
    }
    return { isValid: true };
  }

  dryRun(order: any, config: any): DryRunStepResult {
    const changes: string[] = [];
    if (config.status && config.status !== order.status) {
      changes.push(`status: ${order.status} → ${config.status}`);
    }
    if (config.paymentStatus && config.paymentStatus !== order.paymentStatus) {
      changes.push(`paymentStatus: ${order.paymentStatus} → ${config.paymentStatus}`);
    }
    if (config.fulfillmentStatus && config.fulfillmentStatus !== order.fulfillmentStatus) {
      changes.push(`fulfillmentStatus: ${order.fulfillmentStatus} → ${config.fulfillmentStatus}`);
    }

    return {
      actionType: this.type,
      index: 0,
      description: `Sipariş durumu güncelle: ${changes.join(', ') || 'Değişiklik yok'}`,
      beforeValue: { status: order.status, paymentStatus: order.paymentStatus, fulfillmentStatus: order.fulfillmentStatus },
      afterValue: {
        status: config.status || order.status,
        paymentStatus: config.paymentStatus || order.paymentStatus,
        fulfillmentStatus: config.fulfillmentStatus || order.fulfillmentStatus,
      },
    };
  }

  async execute(order: any, config: any, context: ActionContext) {
    return this.orderService.updateStatus(
      order.id,
      {
        status: config.status,
        paymentStatus: config.paymentStatus,
        fulfillmentStatus: config.fulfillmentStatus,
      },
      context.userId,
      context.agencyId,
      context.clientId || undefined,
      context.storeId,
      false,
      context.ipAddress,
      `automation:${context.ruleId}`,
    );
  }
}
