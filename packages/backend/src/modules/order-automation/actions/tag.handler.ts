import { Injectable } from '@nestjs/common';
import { ActionType, DryRunStepResult } from '../automation-types';
import { ActionContext, ActionHandler } from './action-handler.interface';
import { PrismaService } from '@common/prisma/prisma.service';

@Injectable()
export class TagHandler implements ActionHandler {
  readonly type: ActionType = 'ADD_TAG';

  constructor(private readonly prisma: PrismaService) {}

  validateConfig(config: any) {
    if (!config || !config.tag || typeof config.tag !== 'string' || !config.tag.trim()) {
      return { isValid: false, error: 'Etiket (tag) zorunludur.' };
    }
    return { isValid: true };
  }

  dryRun(order: any, config: any): DryRunStepResult {
    const existing = Array.isArray(order.tags) ? [...order.tags] : [];
    const targetTag = config.tag.trim();
    const isAdd = config.remove !== true;

    let nextTags: string[];
    if (isAdd) {
      nextTags = existing.includes(targetTag) ? existing : [...existing, targetTag];
    } else {
      nextTags = existing.filter((t) => t !== targetTag);
    }

    return {
      actionType: isAdd ? 'ADD_TAG' : 'REMOVE_TAG',
      index: 0,
      description: isAdd ? `"${targetTag}" etiketini ekle` : `"${targetTag}" etiketini kaldır`,
      beforeValue: existing,
      afterValue: nextTags,
    };
  }

  async execute(order: any, config: any, context: ActionContext) {
    const existing = Array.isArray(order.tags) ? [...order.tags] : [];
    const targetTag = config.tag.trim();
    const isAdd = config.remove !== true;

    let nextTags: string[];
    if (isAdd) {
      if (existing.includes(targetTag)) return order;
      nextTags = [...existing, targetTag];
    } else {
      nextTags = existing.filter((t) => t !== targetTag);
    }

    return this.prisma.order.update({
      where: { id: order.id },
      data: { tags: nextTags },
    });
  }
}
