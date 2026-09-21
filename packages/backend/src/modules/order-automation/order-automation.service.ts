import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@common/prisma/prisma.service';
import {
  AutomationCatalog,
  BacktestResult,
  BacktestSample,
  ConditionTree,
  DryRunResult,
  DryRunStepResult,
  TriggerType,
} from './automation-types';
import { FIELD_CATALOG } from './engine/condition-registry';
import { RuleEvaluator } from './engine/rule-evaluator';
import { ActionHandler } from './actions/action-handler.interface';
import { SetOrderStatusHandler } from './actions/set-order-status.handler';
import { TagHandler } from './actions/tag.handler';
import { PriorityHandler } from './actions/priority.handler';
import { HoldHandler } from './actions/hold.handler';
import { CarrierHandler } from './actions/carrier.handler';
import { WarehouseHandler } from './actions/warehouse.handler';
import { NoteHandler } from './actions/note.handler';
import { NotificationHandler } from './actions/notification.handler';
import { WebhookHandler } from './actions/webhook.handler';
import { WaitHandler } from './actions/wait.handler';
import {
  CreateAutomationRuleDto,
  TestRuleDto,
  UpdateAutomationRuleDto,
} from './dto/order-automation.dto';
import { TenantScope, requireStore } from './tenant-scope';

@Injectable()
export class OrderAutomationService {
  private readonly actionHandlers = new Map<string, ActionHandler>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly setOrderStatusHandler: SetOrderStatusHandler,
    private readonly tagHandler: TagHandler,
    private readonly priorityHandler: PriorityHandler,
    private readonly holdHandler: HoldHandler,
    private readonly carrierHandler: CarrierHandler,
    private readonly warehouseHandler: WarehouseHandler,
    private readonly noteHandler: NoteHandler,
    private readonly notificationHandler: NotificationHandler,
    private readonly webhookHandler: WebhookHandler,
    private readonly waitHandler: WaitHandler,
  ) {
    this.registerHandler(this.setOrderStatusHandler);
    this.registerHandler(this.tagHandler);
    this.registerHandler(this.priorityHandler);
    this.registerHandler(this.holdHandler);
    this.registerHandler(this.carrierHandler);
    this.registerHandler(this.warehouseHandler);
    this.registerHandler(this.noteHandler);
    this.registerHandler(this.notificationHandler);
    this.registerHandler(this.webhookHandler);
    this.registerHandler(this.waitHandler);
  }

  private registerHandler(handler: ActionHandler) {
    this.actionHandlers.set(handler.type, handler);
  }

  getActionHandler(type: string): ActionHandler | undefined {
    return this.actionHandlers.get(type);
  }

  /**
   * Audit log helper compliant with CLAUDE.md rule 6.
   */
  private async writeAuditLog(
    tx: Prisma.TransactionClient,
    action: string,
    entityId: string,
    scope: TenantScope,
    actor: { userId?: string; ipAddress?: string },
    changes?: any,
  ) {
    try {
      await tx.auditLog.create({
        data: {
          action,
          entityType: 'AutomationRule',
          entityId,
          userId: actor.userId,
          tenantId: scope.agencyId,
          ipAddress: actor.ipAddress || null,
          newValue: changes ? JSON.parse(JSON.stringify(changes)) : undefined,
        },
      });
    } catch (e) {
      console.error('[order-automation] Audit log failed:', e);
    }
  }

  // ==================== Catalog ====================

  getCatalog(): AutomationCatalog {
    const triggers: Array<{ key: TriggerType; labelKey: string; descriptionKey: string; requiresConfig?: boolean }> = [
      { key: 'ORDER_CREATED', labelKey: 'triggers.order_created', descriptionKey: 'triggers.desc_order_created' },
      { key: 'ORDER_STATUS_CHANGED', labelKey: 'triggers.order_status_changed', descriptionKey: 'triggers.desc_order_status_changed', requiresConfig: true },
      { key: 'PAYMENT_RECEIVED', labelKey: 'triggers.payment_received', descriptionKey: 'triggers.desc_payment_received' },
      { key: 'SHIPMENT_CREATED', labelKey: 'triggers.shipment_created', descriptionKey: 'triggers.desc_shipment_created' },
      { key: 'SHIPMENT_DELIVERED', labelKey: 'triggers.shipment_delivered', descriptionKey: 'triggers.desc_shipment_delivered' },
      { key: 'SHIPMENT_EXCEPTION', labelKey: 'triggers.shipment_exception', descriptionKey: 'triggers.desc_shipment_exception' },
      { key: 'RETURN_REQUESTED', labelKey: 'triggers.return_requested', descriptionKey: 'triggers.desc_return_requested' },
      { key: 'ORDER_CANCELLED', labelKey: 'triggers.order_cancelled', descriptionKey: 'triggers.desc_order_cancelled' },
      { key: 'STOCK_INSUFFICIENT', labelKey: 'triggers.stock_insufficient', descriptionKey: 'triggers.desc_stock_insufficient' },
      { key: 'ORDER_IDLE', labelKey: 'triggers.order_idle', descriptionKey: 'triggers.desc_order_idle', requiresConfig: true },
      { key: 'SCHEDULED', labelKey: 'triggers.scheduled', descriptionKey: 'triggers.desc_scheduled', requiresConfig: true },
    ];

    const actions = [
      {
        key: 'SET_ORDER_STATUS' as const,
        labelKey: 'actions.set_order_status',
        descriptionKey: 'actions.desc_set_order_status',
        configFields: [
          { name: 'status', labelKey: 'fields.status', type: 'enum' as const, required: false },
          { name: 'paymentStatus', labelKey: 'fields.paymentStatus', type: 'enum' as const, required: false },
          { name: 'fulfillmentStatus', labelKey: 'fields.fulfillmentStatus', type: 'enum' as const, required: false },
        ],
      },
      {
        key: 'ADD_TAG' as const,
        labelKey: 'actions.add_tag',
        descriptionKey: 'actions.desc_add_tag',
        configFields: [{ name: 'tag', labelKey: 'fields.tag', type: 'string' as const, required: true }],
      },
      {
        key: 'REMOVE_TAG' as const,
        labelKey: 'actions.remove_tag',
        descriptionKey: 'actions.desc_remove_tag',
        configFields: [{ name: 'tag', labelKey: 'fields.tag', type: 'string' as const, required: true }],
      },
      {
        key: 'SET_PRIORITY' as const,
        labelKey: 'actions.set_priority',
        descriptionKey: 'actions.desc_set_priority',
        configFields: [{ name: 'priority', labelKey: 'fields.priority', type: 'enum' as const, required: true }],
      },
      {
        key: 'HOLD_ORDER' as const,
        labelKey: 'actions.hold_order',
        descriptionKey: 'actions.desc_hold_order',
        configFields: [{ name: 'reason', labelKey: 'fields.holdReason', type: 'string' as const, required: false }],
      },
      {
        key: 'RELEASE_HOLD' as const,
        labelKey: 'actions.release_hold',
        descriptionKey: 'actions.desc_release_hold',
        configFields: [],
      },
      {
        key: 'ASSIGN_CARRIER' as const,
        labelKey: 'actions.assign_carrier',
        descriptionKey: 'actions.desc_assign_carrier',
        configFields: [{ name: 'carrier', labelKey: 'fields.carrier', type: 'string' as const, required: true }],
      },
      {
        key: 'ASSIGN_WAREHOUSE' as const,
        labelKey: 'actions.assign_warehouse',
        descriptionKey: 'actions.desc_assign_warehouse',
        configFields: [{ name: 'warehouseCode', labelKey: 'fields.warehouse', type: 'string' as const, required: true }],
      },
      {
        key: 'SEND_NOTIFICATION' as const,
        labelKey: 'actions.send_notification',
        descriptionKey: 'actions.desc_send_notification',
        configFields: [
          { name: 'channel', labelKey: 'fields.channel', type: 'enum' as const, required: true },
          { name: 'event', labelKey: 'fields.event', type: 'string' as const, required: false },
          { name: 'recipient', labelKey: 'fields.recipient', type: 'string' as const, required: false },
        ],
      },
      {
        key: 'ADD_ORDER_NOTE' as const,
        labelKey: 'actions.add_note',
        descriptionKey: 'actions.desc_add_note',
        configFields: [{ name: 'note', labelKey: 'fields.note', type: 'text' as const, required: true }],
      },
      {
        key: 'CALL_WEBHOOK' as const,
        labelKey: 'actions.call_webhook',
        descriptionKey: 'actions.desc_call_webhook',
        configFields: [
          { name: 'url', labelKey: 'fields.webhookUrl', type: 'string' as const, required: true },
          { name: 'secret', labelKey: 'fields.webhookSecret', type: 'string' as const, required: false },
        ],
      },
      {
        key: 'WAIT' as const,
        labelKey: 'actions.wait',
        descriptionKey: 'actions.desc_wait',
        configFields: [{ name: 'minutes', labelKey: 'fields.waitMinutes', type: 'number' as const, required: true }],
      },
    ];

    const operators = [
      { key: 'eq' as const, labelKey: 'operators.eq' },
      { key: 'neq' as const, labelKey: 'operators.neq' },
      { key: 'gt' as const, labelKey: 'operators.gt' },
      { key: 'gte' as const, labelKey: 'operators.gte' },
      { key: 'lt' as const, labelKey: 'operators.lt' },
      { key: 'lte' as const, labelKey: 'operators.lte' },
      { key: 'between' as const, labelKey: 'operators.between' },
      { key: 'in' as const, labelKey: 'operators.in' },
      { key: 'not_in' as const, labelKey: 'operators.not_in' },
      { key: 'contains' as const, labelKey: 'operators.contains' },
      { key: 'not_contains' as const, labelKey: 'operators.not_contains' },
      { key: 'is_empty' as const, labelKey: 'operators.is_empty' },
      { key: 'is_not_empty' as const, labelKey: 'operators.is_not_empty' },
    ];

    return {
      triggers,
      fields: FIELD_CATALOG,
      operators,
      actions,
      orderStatuses: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
      paymentStatuses: ['pending', 'paid', 'partially_refunded', 'refunded', 'failed'],
      fulfillmentStatuses: ['unfulfilled', 'partially_fulfilled', 'fulfilled', 'returned'],
    };
  }

  // ==================== Rules CRUD ====================

  async findAll(
    scope: TenantScope,
    query?: { search?: string; triggerType?: string; isActive?: boolean },
  ) {
    const where: Prisma.AutomationRuleWhereInput = {
      ...scope.ruleWhere(),
      deletedAt: null,
    };

    if (query?.triggerType) {
      where.triggerType = query.triggerType;
    }
    if (query?.isActive !== undefined) {
      where.isActive = query.isActive;
    }
    if (query?.search && query.search.trim()) {
      where.OR = [
        { name: { contains: query.search.trim(), mode: 'insensitive' } },
        { description: { contains: query.search.trim(), mode: 'insensitive' } },
      ];
    }

    return this.prisma.automationRule.findMany({
      where,
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async findOne(id: string, scope: TenantScope) {
    const rule = await this.prisma.automationRule.findFirst({
      where: {
        id,
        ...scope.ruleWhere(),
        deletedAt: null,
      },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          take: 10,
        },
      },
    });

    if (!rule) {
      throw new NotFoundException(`Kural bulunamadı: ${id}`);
    }

    return rule;
  }

  async create(
    dto: CreateAutomationRuleDto,
    scope: TenantScope,
    actor: { userId?: string; ipAddress?: string },
  ) {
    // Validate actions
    this.validateRuleActions(dto.actions);

    return this.prisma.$transaction(async (tx) => {
      const rule = await tx.automationRule.create({
        data: {
          ...scope.createData(),
          name: dto.name.trim(),
          description: dto.description?.trim() || null,
          triggerType: dto.triggerType,
          triggerConfig: dto.triggerConfig || {},
          conditions: dto.conditions || { version: 1, operator: 'and', conditions: [] },
          actions: dto.actions || [],
          priority: dto.priority ?? 100,
          stopProcessing: !!dto.stopProcessing,
          runOncePerOrder: !!dto.runOncePerOrder,
          isActive: !!dto.isActive,
          scopeLevel: dto.scopeLevel || 'STORE',
          version: 1,
          createdById: actor.userId || null,
          updatedById: actor.userId || null,
        },
      });

      // Save version 1 snapshot
      await tx.automationRuleVersion.create({
        data: {
          ruleId: rule.id,
          version: 1,
          snapshot: rule,
          createdById: actor.userId || null,
        },
      });

      await this.writeAuditLog(tx, 'create', rule.id, scope, actor, {
        name: rule.name,
        triggerType: rule.triggerType,
      });

      return rule;
    });
  }

  async update(
    id: string,
    dto: UpdateAutomationRuleDto,
    scope: TenantScope,
    actor: { userId?: string; ipAddress?: string },
  ) {
    const existing = await this.findOne(id, scope);

    if (dto.actions) {
      this.validateRuleActions(dto.actions);
    }

    const nextVersion = existing.version + 1;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.automationRule.update({
        where: { id: existing.id },
        data: {
          name: dto.name !== undefined ? dto.name.trim() : undefined,
          description: dto.description !== undefined ? dto.description?.trim() || null : undefined,
          triggerType: dto.triggerType !== undefined ? dto.triggerType : undefined,
          triggerConfig: dto.triggerConfig !== undefined ? dto.triggerConfig : undefined,
          conditions: dto.conditions !== undefined ? dto.conditions : undefined,
          actions: dto.actions !== undefined ? dto.actions : undefined,
          priority: dto.priority !== undefined ? dto.priority : undefined,
          stopProcessing: dto.stopProcessing !== undefined ? dto.stopProcessing : undefined,
          runOncePerOrder: dto.runOncePerOrder !== undefined ? dto.runOncePerOrder : undefined,
          isActive: dto.isActive !== undefined ? dto.isActive : undefined,
          version: nextVersion,
          updatedById: actor.userId || null,
        },
      });

      // Record version snapshot
      await tx.automationRuleVersion.create({
        data: {
          ruleId: updated.id,
          version: nextVersion,
          snapshot: updated,
          createdById: actor.userId || null,
        },
      });

      await this.writeAuditLog(tx, 'update', id, scope, actor, {
        version: nextVersion,
        changes: dto,
      });

      return updated;
    });
  }

  async toggle(
    id: string,
    scope: TenantScope,
    actor: { userId?: string; ipAddress?: string },
  ) {
    const existing = await this.findOne(id, scope);
    const nextState = !existing.isActive;

    const updated = await this.prisma.automationRule.update({
      where: { id },
      data: { isActive: nextState },
    });

    return updated;
  }

  async reorder(
    ruleIds: string[],
    scope: TenantScope,
    actor: { userId?: string; ipAddress?: string },
  ) {
    if (!Array.isArray(ruleIds) || ruleIds.length === 0) {
      throw new BadRequestException('ruleIds dizisi gereklidir.');
    }

    return this.prisma.$transaction(async (tx) => {
      let priority = 10;
      for (const id of ruleIds) {
        await tx.automationRule.updateMany({
          where: { id, ...scope.ruleWhere(), deletedAt: null },
          data: { priority },
        });
        priority += 10;
      }
      return { success: true, count: ruleIds.length };
    });
  }

  async duplicate(
    id: string,
    scope: TenantScope,
    actor: { userId?: string; ipAddress?: string },
  ) {
    const existing = await this.findOne(id, scope);

    return this.create(
      {
        name: `${existing.name} (Kopya)`,
        description: existing.description || undefined,
        triggerType: existing.triggerType,
        triggerConfig: existing.triggerConfig as any,
        conditions: existing.conditions as any,
        actions: existing.actions as any,
        priority: existing.priority + 1,
        stopProcessing: existing.stopProcessing,
        runOncePerOrder: existing.runOncePerOrder,
        isActive: false, // Duplicates always start paused
        scopeLevel: existing.scopeLevel,
      },
      scope,
      actor,
    );
  }

  async remove(
    id: string,
    scope: TenantScope,
    actor: { userId?: string; ipAddress?: string },
  ) {
    await this.findOne(id, scope);

    await this.prisma.automationRule.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });

    return { success: true };
  }

  async getVersions(id: string, scope: TenantScope) {
    await this.findOne(id, scope);
    return this.prisma.automationRuleVersion.findMany({
      where: { ruleId: id },
      orderBy: { version: 'desc' },
    });
  }

  async restoreVersion(
    id: string,
    versionId: string,
    scope: TenantScope,
    actor: { userId?: string; ipAddress?: string },
  ) {
    const rule = await this.findOne(id, scope);
    const ver = await this.prisma.automationRuleVersion.findFirst({
      where: { id: versionId, ruleId: id },
    });

    if (!ver) {
      throw new NotFoundException('Geri yüklenecek versiyon bulunamadı.');
    }

    const snap = ver.snapshot as any;
    return this.update(
      id,
      {
        name: snap.name,
        description: snap.description,
        triggerType: snap.triggerType,
        triggerConfig: snap.triggerConfig,
        conditions: snap.conditions,
        actions: snap.actions,
        stopProcessing: snap.stopProcessing,
        runOncePerOrder: snap.runOncePerOrder,
        priority: snap.priority,
      },
      scope,
      actor,
    );
  }

  // ==================== Test & Backtest (Read-Only) ====================

  async dryRunTest(dto: TestRuleDto, scope: TenantScope): Promise<DryRunResult> {
    const order = await this.loadOrderForAutomation(dto.orderId, scope);
    if (!order) {
      throw new NotFoundException(`Sipariş bulunamadı: ${dto.orderId}`);
    }

    let conditions: ConditionTree;
    let actions: Array<{ type: string; config: any }>;

    if (dto.ruleId) {
      const rule = await this.findOne(dto.ruleId, scope);
      conditions = rule.conditions as any;
      actions = rule.actions as any;
    } else if (dto.rule) {
      conditions = dto.rule.conditions as any;
      actions = dto.rule.actions as any;
    } else {
      throw new BadRequestException('ruleId veya rule payload gereklidir.');
    }

    // Evaluate conditions
    const { matched, trace } = RuleEvaluator.evaluate(order, conditions);

    // Plan dry run actions if matched
    const plannedActions: DryRunStepResult[] = [];
    if (matched && Array.isArray(actions)) {
      actions.forEach((act, idx) => {
        const handler = this.actionHandlers.get(act.type);
        if (handler) {
          const step = handler.dryRun(order, act.config);
          step.index = idx;
          plannedActions.push(step);
        } else {
          plannedActions.push({
            actionType: act.type as any,
            index: idx,
            description: `Bilinmeyen aksiyon tipi: ${act.type}`,
          });
        }
      });
    }

    return {
      matched,
      conditionTrace: trace,
      plannedActions,
    };
  }

  async backtest(id: string, days = 30, scope: TenantScope): Promise<BacktestResult> {
    const rule = await this.findOne(id, scope);
    const conditions = (rule.conditions as unknown) as ConditionTree;
    const storeId = requireStore(scope);

    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const orders = await this.prisma.order.findMany({
      where: {
        storeId,
        createdAt: { gte: since },
        deletedAt: null,
      },
      include: {
        items: {
          include: { product: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 200, // Safe scan cap
    });

    let matchedCount = 0;
    const samples: BacktestSample[] = [];

    for (const ord of orders) {
      const { matched } = RuleEvaluator.evaluate(ord, conditions);
      if (matched) {
        matchedCount++;
        if (samples.length < 10) {
          samples.push({
            orderId: ord.id,
            orderNumber: ord.orderNumber,
            customerName: ord.customerName,
            status: ord.status,
            totalAmount: Number(ord.totalAmount),
            currency: ord.currency,
            createdAt: ord.createdAt.toISOString(),
          });
        }
      }
    }

    const totalScanned = orders.length;
    const matchRatioPercentage = totalScanned > 0 ? Math.round((matchedCount / totalScanned) * 100) : 0;

    return {
      totalScanned,
      matchedCount,
      matchRatioPercentage,
      samples,
    };
  }

  // ==================== Execution Pipeline ====================

  async runRuleManually(
    id: string,
    orderIds: string[] | undefined,
    scope: TenantScope,
    actor: { userId?: string; ipAddress?: string },
  ) {
    const rule = await this.findOne(id, scope);
    if (!rule.isActive) {
      throw new BadRequestException('Pasif bir kural çalıştırılamaz. Önce kuralı etkinleştirin.');
    }

    const storeId = requireStore(scope);
    let targetOrders: any[] = [];
    if (Array.isArray(orderIds) && orderIds.length > 0) {
      targetOrders = await this.prisma.order.findMany({
        where: { id: { in: orderIds }, storeId, deletedAt: null },
        include: { items: { include: { product: true } } },
      });
    } else {
      // Default: check last 50 orders in the store
      targetOrders = await this.prisma.order.findMany({
        where: { storeId, deletedAt: null },
        include: { items: { include: { product: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    }

    let applied = 0;
    let skipped = 0;
    let failed = 0;

    for (const order of targetOrders) {
      const eventId = `manual:${rule.id}:${order.id}:${Date.now()}`;
      const result = await this.executeRuleOnOrder(rule, order, 'MANUAL_RUN', eventId, 0, actor);
      if (result.status === 'MATCHED_SUCCESS') applied++;
      else if (result.status === 'PARTIAL_FAILURE' || result.status === 'FAILED') failed++;
      else skipped++;
    }

    return { applied, skipped, failed, scanned: targetOrders.length };
  }

  async executeRuleOnOrder(
    rule: any,
    order: any,
    triggerEvent: string,
    eventId: string,
    depth = 0,
    actor?: { userId?: string; ipAddress?: string },
  ) {
    // 1. Loop protection
    if (depth > 3) {
      return this.recordRun(rule, order, triggerEvent, eventId, false, null, 'SKIPPED_LOOP', depth);
    }

    // 2. Idempotency check
    if (rule.runOncePerOrder) {
      const prior = await this.prisma.automationRun.findFirst({
        where: { ruleId: rule.id, orderId: order.id, status: 'MATCHED_SUCCESS' },
      });
      if (prior) {
        return this.recordRun(rule, order, triggerEvent, eventId, false, null, 'SKIPPED_ONCE', depth);
      }
    }

    // 3. Evaluate conditions
    const startTime = Date.now();
    const { matched, trace } = RuleEvaluator.evaluate(order, rule.conditions);

    if (!matched) {
      return this.recordRun(rule, order, triggerEvent, eventId, false, trace, 'NOT_MATCHED', depth, Date.now() - startTime);
    }

    // 4. Execute sequential actions
    const actions = Array.isArray(rule.actions) ? rule.actions : [];
    let hasFailure = false;
    const actionRunRecords: Array<{
      index: number;
      actionType: string;
      status: string;
      input: any;
      output: any;
      errorMessage?: string;
    }> = [];

    const context = {
      agencyId: rule.agencyId,
      clientId: rule.clientId,
      storeId: rule.storeId,
      ruleId: rule.id,
      userId: actor?.userId,
      ipAddress: actor?.ipAddress,
      depth,
    };

    for (let i = 0; i < actions.length; i++) {
      const act = actions[i];
      const handler = this.actionHandlers.get(act.type);

      if (!handler) {
        hasFailure = true;
        actionRunRecords.push({
          index: i,
          actionType: act.type,
          status: 'FAILED',
          input: act.config,
          output: null,
          errorMessage: `Desteklenmeyen aksiyon tipi: ${act.type}`,
        });
        break; // Stop remaining actions on error
      }

      try {
        const out = await handler.execute(order, act.config, context);
        actionRunRecords.push({
          index: i,
          actionType: act.type,
          status: act.type === 'WAIT' ? 'SCHEDULED' : 'SUCCESS',
          input: act.config,
          output: out,
        });
      } catch (err: any) {
        hasFailure = true;
        actionRunRecords.push({
          index: i,
          actionType: act.type,
          status: 'FAILED',
          input: act.config,
          output: null,
          errorMessage: err?.message || 'Aksiyon çalışırken hata oluştu.',
        });
        break; // Stop remaining actions in this rule
      }
    }

    const runStatus = hasFailure ? 'PARTIAL_FAILURE' : 'MATCHED_SUCCESS';
    const durationMs = Date.now() - startTime;

    // Update rule counters
    await this.prisma.automationRule.update({
      where: { id: rule.id },
      data: {
        lastRunAt: new Date(),
        runCount: { increment: 1 },
        ...(hasFailure ? { errorCount: { increment: 1 } } : {}),
      },
    });

    return this.recordRun(
      rule,
      order,
      triggerEvent,
      eventId,
      true,
      trace,
      runStatus,
      depth,
      durationMs,
      actionRunRecords,
    );
  }

  private async recordRun(
    rule: any,
    order: any,
    triggerEvent: string,
    eventId: string,
    matched: boolean,
    trace: any,
    status: string,
    depth: number,
    durationMs?: number,
    actionRuns?: Array<{
      index: number;
      actionType: string;
      status: string;
      input: any;
      output: any;
      errorMessage?: string;
    }>,
  ) {
    return this.prisma.automationRun.upsert({
      where: {
        ruleId_eventId: { ruleId: rule.id, eventId },
      },
      update: {},
      create: {
        agencyId: rule.agencyId,
        clientId: rule.clientId,
        storeId: rule.storeId,
        ruleId: rule.id,
        ruleVersion: rule.version || 1,
        orderId: order.id,
        triggerEvent,
        eventId,
        matched,
        conditionTrace: trace || undefined,
        status,
        depth,
        durationMs,
        actionRuns: actionRuns?.length
          ? {
              create: actionRuns.map((a) => ({
                index: a.index,
                actionType: a.actionType,
                status: a.status,
                input: a.input ? JSON.parse(JSON.stringify(a.input)) : undefined,
                output: a.output ? JSON.parse(JSON.stringify(a.output)) : undefined,
                errorMessage: a.errorMessage,
              })),
            }
          : undefined,
      },
    });
  }

  // ==================== Runs Querying & Retry ====================

  async findAllRuns(
    scope: TenantScope,
    query?: {
      ruleId?: string;
      orderId?: string;
      status?: string;
      includeSkipped?: boolean;
      page?: number;
      limit?: number;
    },
  ) {
    const page = Math.max(1, Number(query?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query?.limit) || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.AutomationRunWhereInput = {
      ...scope.runWhere(),
    };

    if (query?.ruleId) where.ruleId = query.ruleId;
    if (query?.orderId) where.orderId = query.orderId;
    if (query?.status) {
      where.status = query.status;
    } else if (!query?.includeSkipped) {
      where.status = { not: 'SKIPPED' };
    }

    const [items, total] = await Promise.all([
      this.prisma.automationRun.findMany({
        where,
        include: {
          rule: { select: { id: true, name: true } },
          order: { select: { id: true, orderNumber: true, customerName: true } },
          actionRuns: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.automationRun.count({ where }),
    ]);

    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findRun(runId: string, scope: TenantScope) {
    const run = await this.prisma.automationRun.findFirst({
      where: { id: runId, ...scope.runWhere() },
      include: {
        rule: true,
        order: {
          include: { items: true },
        },
        actionRuns: {
          orderBy: { index: 'asc' },
        },
      },
    });

    if (!run) {
      throw new NotFoundException(`Çalışma kaydı bulunamadı: ${runId}`);
    }

    return run;
  }

  async retryRun(runId: string, scope: TenantScope, actor: { userId?: string; ipAddress?: string }) {
    const run = await this.findRun(runId, scope);
    const order = await this.loadOrderForAutomation(run.orderId, scope);

    if (!order) {
      throw new NotFoundException(`Sipariş bulunamadı: ${run.orderId}`);
    }

    const eventId = `retry:${run.id}:${Date.now()}`;
    return this.executeRuleOnOrder(run.rule, order, 'RETRY', eventId, 0, actor);
  }

  private async loadOrderForAutomation(orderId: string, scope: TenantScope) {
    return this.prisma.order.findFirst({
      where: {
        id: orderId,
        storeId: requireStore(scope),
        deletedAt: null,
      },
      include: {
        items: {
          include: { product: true },
        },
      },
    });
  }

  private validateRuleActions(actions: any[]) {
    if (!Array.isArray(actions) || actions.length === 0) {
      throw new BadRequestException('En az bir aksiyon tanımlanmalıdır.');
    }

    for (const act of actions) {
      const handler = this.actionHandlers.get(act.type);
      if (!handler) {
        throw new BadRequestException(`Geçersiz aksiyon tipi: ${act.type}`);
      }
      const val = handler.validateConfig(act.config);
      if (!val.isValid) {
        throw new BadRequestException(`Aksiyon yapılandırma hatası (${act.type}): ${val.error}`);
      }
    }
  }
}
