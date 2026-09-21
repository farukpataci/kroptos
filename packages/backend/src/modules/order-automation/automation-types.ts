export type ScopeLevel = 'STORE' | 'CLIENT' | 'AGENCY';

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

export type LogicalOperator = 'and' | 'or';

export interface SingleCondition {
  field: string;
  operator: ConditionOperator;
  value?: any;
}

export interface ConditionGroup {
  operator: LogicalOperator;
  conditions: Array<SingleCondition | ConditionGroup>;
}

export interface ConditionTree {
  version: number;
  operator: LogicalOperator;
  conditions: Array<SingleCondition | ConditionGroup>;
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

export interface ActionDefinition {
  type: ActionType;
  config: Record<string, any>;
}

export type RunStatus =
  | 'MATCHED_SUCCESS'
  | 'PARTIAL_FAILURE'
  | 'FAILED'
  | 'NOT_MATCHED'
  | 'SKIPPED_LOOP'
  | 'SKIPPED_ONCE'
  | 'DRY_RUN';

export interface SingleConditionTrace {
  type: 'condition';
  field: string;
  operator: ConditionOperator;
  expectedValue: any;
  actualValue: any;
  passed: boolean;
}

export interface GroupConditionTrace {
  type: 'group';
  operator: LogicalOperator;
  passed: boolean;
  children: Array<SingleConditionTrace | GroupConditionTrace>;
}

export interface ConditionTrace {
  rootPassed: boolean;
  tree: GroupConditionTrace;
}

export interface ActionExecutionResult {
  actionType: ActionType;
  index: number;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED' | 'SCHEDULED';
  input?: any;
  output?: any;
  errorMessage?: string;
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

export interface CatalogField {
  key: string;
  labelKey: string;
  type: 'string' | 'number' | 'boolean' | 'enum' | 'array' | 'date';
  operators: ConditionOperator[];
  options?: Array<{ value: string; labelKey: string }>;
}

export interface CatalogTrigger {
  key: TriggerType;
  labelKey: string;
  descriptionKey: string;
  requiresConfig?: boolean;
}

export interface CatalogAction {
  key: ActionType;
  labelKey: string;
  descriptionKey: string;
  configFields: Array<{
    name: string;
    labelKey: string;
    type: 'string' | 'number' | 'boolean' | 'enum' | 'text';
    required: boolean;
    options?: Array<{ value: string; labelKey: string }>;
  }>;
}

export interface AutomationCatalog {
  triggers: CatalogTrigger[];
  fields: CatalogField[];
  operators: Array<{ key: ConditionOperator; labelKey: string }>;
  actions: CatalogAction[];
  orderStatuses: string[];
  paymentStatuses: string[];
  fulfillmentStatuses: string[];
}
