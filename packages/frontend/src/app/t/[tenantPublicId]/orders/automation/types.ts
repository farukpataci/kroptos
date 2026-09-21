export type TriggerType =
  | 'ORDER_CREATED'
  | 'ORDER_STATUS_CHANGED'
  | 'PAYMENT_RECEIVED'
  | 'SHIPMENT_CREATED'
  | 'SHIPMENT_DELIVERED'
  | 'SHIPMENT_EXCEPTION'
  | 'RETURN_REQUESTED'
  | 'ORDER_CANCELLED'
  | 'STOCK_INSUFFICIENT'
  | 'ORDER_IDLE'
  | 'SCHEDULED';

export type ConditionOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'between'
  | 'in'
  | 'not_in'
  | 'contains'
  | 'not_contains'
  | 'is_empty'
  | 'is_not_empty';

export interface ConditionNode {
  field: string;
  operator: ConditionOperator;
  value?: any;
}

export interface ConditionTree {
  version: 1;
  operator: 'and' | 'or';
  conditions: Array<ConditionNode | ConditionTree>;
}

export type ActionType =
  | 'SET_ORDER_STATUS'
  | 'ADD_TAG'
  | 'REMOVE_TAG'
  | 'SET_PRIORITY'
  | 'HOLD_ORDER'
  | 'RELEASE_HOLD'
  | 'ASSIGN_CARRIER'
  | 'ASSIGN_WAREHOUSE'
  | 'CREATE_INVOICE'
  | 'SEND_NOTIFICATION'
  | 'ADD_ORDER_NOTE'
  | 'ASSIGN_USER'
  | 'CALL_WEBHOOK'
  | 'WAIT';

export interface RuleAction {
  type: ActionType;
  config: Record<string, any>;
}

export interface AutomationRule {
  id: string;
  name: string;
  description?: string | null;
  triggerType: TriggerType;
  triggerConfig?: Record<string, any>;
  conditions: ConditionTree;
  actions: RuleAction[];
  priority: number;
  stopProcessing: boolean;
  runOncePerOrder: boolean;
  isActive: boolean;
  version: number;
  lastRunAt?: string | null;
  matchCount: number;
  createdAt: string;
  updatedAt: string;
  versions?: AutomationRuleVersion[];
  runs24hCount?: number;
  errors24hCount?: number;
}

export interface AutomationRuleVersion {
  id: string;
  ruleId: string;
  version: number;
  snapshot: any;
  changeSummary?: string | null;
  createdAt: string;
}

export interface AutomationActionRun {
  id: string;
  runId: string;
  actionType: string;
  stepIndex: number;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  inputPayload?: any;
  outputPayload?: any;
  errorMessage?: string | null;
  durationMs: number;
}

export interface ConditionTrace {
  operator: 'and' | 'or';
  matched: boolean;
  children: Array<{
    field?: string;
    operator?: string;
    expected?: any;
    actual?: any;
    matched: boolean;
    children?: any[];
  }>;
}

export interface AutomationRun {
  id: string;
  ruleId: string;
  orderId: string;
  agencyId: string;
  storeId: string;
  triggerEvent: string;
  eventId: string;
  status: 'SUCCESS' | 'PARTIAL_SUCCESS' | 'FAILED' | 'SKIPPED';
  skipReason?: string | null;
  conditionTrace?: ConditionTrace | null;
  durationMs: number;
  createdAt: string;
  rule?: { id: string; name: string };
  order?: {
    id: string;
    orderNumber: string;
    customerName: string;
    status: string;
    totalAmount: any;
    currency: string;
  };
  actionRuns?: AutomationActionRun[];
}

export interface CatalogFieldOption {
  value: string;
  labelKey: string;
}

export interface CatalogField {
  key: string;
  labelKey: string;
  type: 'string' | 'number' | 'boolean' | 'enum' | 'array' | 'date';
  operators: ConditionOperator[];
  options?: CatalogFieldOption[];
}

export interface CatalogTrigger {
  key: TriggerType;
  labelKey: string;
  descriptionKey: string;
  requiresConfig?: boolean;
}

export interface CatalogActionField {
  name: string;
  labelKey: string;
  type: 'string' | 'number' | 'boolean' | 'enum' | 'text';
  required: boolean;
  options?: CatalogFieldOption[];
}

export interface CatalogAction {
  key: ActionType;
  labelKey: string;
  descriptionKey: string;
  configFields: CatalogActionField[];
}

export interface AutomationCatalog {
  triggers: CatalogTrigger[];
  fields: CatalogField[];
  operators: Array<{ key: ConditionOperator; labelKey: string; symbol: string }>;
  actions: CatalogAction[];
}

export interface DryRunStepResult {
  actionType: ActionType;
  index: number;
  description: string;
  beforeValue?: any;
  afterValue?: any;
}

export interface DryRunResult {
  matched: boolean;
  conditionTrace: ConditionTrace;
  plannedActions: DryRunStepResult[];
}

export interface BacktestSample {
  orderId: string;
  orderNumber: string;
  customerName: string;
  status: string;
  totalAmount: number;
  currency: string;
  createdAt: string;
}

export interface BacktestResult {
  totalScanned: number;
  matchedCount: number;
  matchRatioPercentage: number;
  samples: BacktestSample[];
}

export interface RecipeTemplate {
  id: string;
  name: string;
  description: string;
  category: 'payment' | 'shipping' | 'fulfillment' | 'customer' | 'exception';
  triggerType: TriggerType;
  triggerConfig?: Record<string, any>;
  conditions: ConditionTree;
  actions: RuleAction[];
  priority: number;
  stopProcessing?: boolean;
  runOncePerOrder?: boolean;
}
