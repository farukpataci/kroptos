import { Injectable } from '@nestjs/common';
import { ActionType, DryRunStepResult } from '../automation-types';
import { ActionContext, ActionHandler } from './action-handler.interface';
import { PrismaService } from '@common/prisma/prisma.service';

@Injectable()
export class PriorityHandler implements ActionHandler {
  readonly type: ActionType = 'SET_PRIORITY';

  constructor(private readonly prisma: PrismaService) {}

  validateConfig(config: any) {
    if (!config || !config.priority) {
      return { isValid: false, error: 'Öncelik değeri (urgent, high, normal, low) zorunludur.' };
    }
    return { isValid: true };
  }

  dryRun(order: any, config: any): DryRunStepResult {
    return {
      actionType: this.type,
      index: 0,
      description: `Önceliği "${config.priority}" olarak güncelle`,
      beforeValue: order.priority || 'normal',
      afterValue: config.priority,
    };
  }

  async execute(order: any, config: any, context: ActionContext) {
    return this.prisma.order.update({
      where: { id: order.id },
      data: { priority: config.priority },
    });
  }
}
