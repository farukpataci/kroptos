import { Injectable } from '@nestjs/common';
import { ActionType, DryRunStepResult } from '../automation-types';
import { ActionContext, ActionHandler } from './action-handler.interface';
import { PrismaService } from '@common/prisma/prisma.service';

@Injectable()
export class WarehouseHandler implements ActionHandler {
  readonly type: ActionType = 'ASSIGN_WAREHOUSE';

  constructor(private readonly prisma: PrismaService) {}

  validateConfig(config: any) {
    if (!config || (!config.warehouseId && !config.warehouseCode)) {
      return { isValid: false, error: 'Depo bilgisi (warehouseId veya warehouseCode) zorunludur.' };
    }
    return { isValid: true };
  }

  dryRun(order: any, config: any): DryRunStepResult {
    return {
      actionType: this.type,
      index: 0,
      description: `Siparişi depoya ata (${config.warehouseCode || config.warehouseId})`,
      beforeValue: null,
      afterValue: config.warehouseCode || config.warehouseId,
    };
  }

  async execute(order: any, config: any, context: ActionContext) {
    const note = `[Otomasyon] Depo ataması yapıldı: ${config.warehouseCode || config.warehouseId}`;
    const newNotes = order.notes ? `${order.notes}\n${note}` : note;
    return this.prisma.order.update({
      where: { id: order.id },
      data: { notes: newNotes },
    });
  }
}
