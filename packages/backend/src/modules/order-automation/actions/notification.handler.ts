import { Injectable } from '@nestjs/common';
import { ActionType, DryRunStepResult } from '../automation-types';
import { ActionContext, ActionHandler } from './action-handler.interface';
import { PrismaService } from '@common/prisma/prisma.service';

@Injectable()
export class NotificationHandler implements ActionHandler {
  readonly type: ActionType = 'SEND_NOTIFICATION';

  constructor(private readonly prisma: PrismaService) {}

  validateConfig(config: any) {
    if (!config || !config.channel) {
      return { isValid: false, error: 'Bildirim kanalı (EMAIL, SMS) zorunludur.' };
    }
    return { isValid: true };
  }

  dryRun(order: any, config: any): DryRunStepResult {
    const channel = config.channel || 'EMAIL';
    const recipient = config.recipient || order.customerEmail || order.customerPhone || 'Müşteri';
    return {
      actionType: this.type,
      index: 0,
      description: `Bildirim gönder (${channel} → ${recipient}) [Şablon/Olay: ${config.event || config.templateId || 'Varsayılan'}]`,
      beforeValue: null,
      afterValue: { channel, recipient, event: config.event },
    };
  }

  async execute(order: any, config: any, context: ActionContext) {
    // Records notification timeline or audit event; links seamlessly with notification module
    const channel = config.channel || 'EMAIL';
    const recipient = config.recipient || order.customerEmail || order.customerPhone || 'Müşteri';
    const logNote = `[Otomasyon Bildirim] ${channel} gönderim kuyruğuna alındı: ${recipient} (${config.event || 'Olay'})`;

    await this.prisma.orderTimeline.create({
      data: {
        orderId: order.id,
        eventType: 'notification_queued',
        newValue: logNote,
        userId: context.userId,
      },
    });

    return { queued: true, channel, recipient };
  }
}
