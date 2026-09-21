import { ActionType, DryRunStepResult } from '../automation-types';

export interface ActionContext {
  agencyId: string;
  clientId?: string | null;
  storeId: string;
  ruleId: string;
  userId?: string;
  ipAddress?: string;
  depth?: number;
}

export interface ActionHandler {
  readonly type: ActionType;
  validateConfig(config: any): { isValid: boolean; error?: string };
  dryRun(order: any, config: any): DryRunStepResult;
  execute(order: any, config: any, context: ActionContext): Promise<any>;
}
