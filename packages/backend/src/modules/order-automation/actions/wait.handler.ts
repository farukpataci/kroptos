import { Injectable } from '@nestjs/common';
import { ActionType, DryRunStepResult } from '../automation-types';
import { ActionContext, ActionHandler } from './action-handler.interface';

@Injectable()
export class WaitHandler implements ActionHandler {
  readonly type: ActionType = 'WAIT';

  validateConfig(config: any) {
    const minutes = Number(config?.minutes || config?.delayMinutes);
    if (!minutes || minutes <= 0) {
      return { isValid: false, error: 'Gecikme süresi (dakika) pozitif sayı olmalıdır.' };
    }
    return { isValid: true };
  }

  dryRun(order: any, config: any): DryRunStepResult {
    const minutes = Number(config?.minutes || config?.delayMinutes || 5);
    return {
      actionType: this.type,
      index: 0,
      description: `${minutes} dakika bekle ve sonraki adımları ertele`,
      beforeValue: null,
      afterValue: { delayMinutes: minutes },
    };
  }

  async execute(order: any, config: any, context: ActionContext) {
    const minutes = Number(config?.minutes || config?.delayMinutes || 5);
    const scheduledFor = new Date(Date.now() + minutes * 60 * 1000);

    return {
      scheduledFor: scheduledFor.toISOString(),
      delayMinutes: minutes,
    };
  }
}
