import { Injectable } from '@nestjs/common';
import { ActionType, DryRunStepResult } from '../automation-types';
import { ActionContext, ActionHandler } from './action-handler.interface';
import { PrismaService } from '@common/prisma/prisma.service';

@Injectable()
export class NoteHandler implements ActionHandler {
  readonly type: ActionType = 'ADD_ORDER_NOTE';

  constructor(private readonly prisma: PrismaService) {}

  validateConfig(config: any) {
    if (!config || !config.note || typeof config.note !== 'string' || !config.note.trim()) {
      return { isValid: false, error: 'Not metni zorunludur.' };
    }
    return { isValid: true };
  }

  dryRun(order: any, config: any): DryRunStepResult {
    const existing = order.notes || '';
    const noteText = config.note.trim();
    const updated = existing ? `${existing}\n${noteText}` : noteText;

    return {
      actionType: this.type,
      index: 0,
      description: `Sipariş notu ekle: "${noteText}"`,
      beforeValue: existing,
      afterValue: updated,
    };
  }

  async execute(order: any, config: any, context: ActionContext) {
    const existing = order.notes || '';
    const noteText = `[${new Date().toISOString()}] ${config.note.trim()}`;
    const updated = existing ? `${existing}\n${noteText}` : noteText;

    return this.prisma.order.update({
      where: { id: order.id },
      data: { notes: updated },
    });
  }
}
