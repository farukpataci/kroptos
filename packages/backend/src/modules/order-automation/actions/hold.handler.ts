import { Injectable } from '@nestjs/common';
import { ActionType, DryRunStepResult } from '../automation-types';
import { ActionContext, ActionHandler } from './action-handler.interface';
import { PrismaService } from '@common/prisma/prisma.service';

@Injectable()
export class HoldHandler implements ActionHandler {
  readonly type: ActionType = 'HOLD_ORDER';

  constructor(private readonly prisma: PrismaService) {}

  validateConfig(config: any) {
    return { isValid: true };
  }

  dryRun(order: any, config: any): DryRunStepResult {
    const isHold = config.release !== true;
    return {
      actionType: isHold ? 'HOLD_ORDER' : 'RELEASE_HOLD',
      index: 0,
      description: isHold
        ? `Siparişi bekletmeye al (Neden: ${config.reason || 'Otomasyon kuralı'})`
        : 'Siparişin bekletmesini kaldır',
      beforeValue: { isHold: order.isHold, holdReason: order.holdReason },
      afterValue: { isHold, holdReason: isHold ? config.reason || 'Otomasyon kuralı' : null },
    };
  }

  async execute(order: any, config: any, context: ActionContext) {
    const isHold = config.release !== true;
    return this.prisma.order.update({
      where: { id: order.id },
      data: {
        isHold,
        holdReason: isHold ? config.reason || 'Otomasyon kuralı' : null,
      },
    });
  }
}
