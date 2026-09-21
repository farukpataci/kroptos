import { Injectable } from '@nestjs/common';
import { ActionType, DryRunStepResult } from '../automation-types';
import { ActionContext, ActionHandler } from './action-handler.interface';
import { PrismaService } from '@common/prisma/prisma.service';

@Injectable()
export class CarrierHandler implements ActionHandler {
  readonly type: ActionType = 'ASSIGN_CARRIER';

  constructor(private readonly prisma: PrismaService) {}

  validateConfig(config: any) {
    if (!config || !config.carrier) {
      return { isValid: false, error: 'Kargo taşıyıcısı belirtilmelidir.' };
    }
    return { isValid: true };
  }

  dryRun(order: any, config: any): DryRunStepResult {
    return {
      actionType: this.type,
      index: 0,
      description: `Kargo firmasını "${config.carrier}" olarak ata`,
      beforeValue: order.carrierId || null,
      afterValue: config.carrier,
    };
  }

  async execute(order: any, config: any, context: ActionContext) {
    // Carrier assignment appends note and assigns carrier metadata
    const note = `[Otomasyon] Kargo firması atandı: ${config.carrier}`;
    const newNotes = order.notes ? `${order.notes}\n${note}` : note;
    return this.prisma.order.update({
      where: { id: order.id },
      data: { notes: newNotes },
    });
  }
}
