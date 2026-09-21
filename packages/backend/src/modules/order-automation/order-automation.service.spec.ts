import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service';
import { OrderAutomationService } from './order-automation.service';
import { createTenantScopeMock } from './tenant-scope';
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
import { CreateAutomationRuleDto } from './dto/order-automation.dto';

describe('OrderAutomationService', () => {
  let service: OrderAutomationService;

  const mockPrisma: any = {
    automationRule: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    automationRuleVersion: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    automationRun: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    },
    order: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    auditLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn((cb) => cb(mockPrisma)),
  };

  const scope = createTenantScopeMock({
    agencyId: 'agency-1',
    clientId: 'client-1',
    storeId: 'store-1',
  });

  const actor = { userId: 'user-1', ipAddress: '127.0.0.1' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderAutomationService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SetOrderStatusHandler, useValue: { type: 'SET_ORDER_STATUS', validateConfig: jest.fn().mockReturnValue({ isValid: true }), execute: jest.fn(), dryRun: jest.fn().mockReturnValue({ actionType: 'SET_ORDER_STATUS', index: 0, description: 'Durum değiştirilecek' }) } },
        { provide: TagHandler, useValue: { type: 'ADD_TAG', validateConfig: jest.fn().mockReturnValue({ isValid: true }), execute: jest.fn(), dryRun: jest.fn().mockReturnValue({ actionType: 'ADD_TAG', index: 0, description: 'Etiket eklenecek: VIP' }) } },
        { provide: PriorityHandler, useValue: { type: 'SET_PRIORITY', validateConfig: jest.fn().mockReturnValue({ isValid: true }), execute: jest.fn(), dryRun: jest.fn().mockReturnValue({ actionType: 'SET_PRIORITY', index: 0, description: 'Öncelik verilecek' }) } },
        { provide: HoldHandler, useValue: { type: 'HOLD_ORDER', validateConfig: jest.fn().mockReturnValue({ isValid: true }), execute: jest.fn(), dryRun: jest.fn().mockReturnValue({ actionType: 'HOLD_ORDER', index: 0, description: 'Beklemeye alınacak' }) } },
        { provide: CarrierHandler, useValue: { type: 'ASSIGN_CARRIER', validateConfig: jest.fn().mockReturnValue({ isValid: true }), execute: jest.fn(), dryRun: jest.fn().mockReturnValue({ actionType: 'ASSIGN_CARRIER', index: 0, description: 'Kargo atanacak' }) } },
        { provide: WarehouseHandler, useValue: { type: 'ASSIGN_WAREHOUSE', validateConfig: jest.fn().mockReturnValue({ isValid: true }), execute: jest.fn(), dryRun: jest.fn().mockReturnValue({ actionType: 'ASSIGN_WAREHOUSE', index: 0, description: 'Depo atanacak' }) } },
        { provide: NoteHandler, useValue: { type: 'ADD_ORDER_NOTE', validateConfig: jest.fn().mockReturnValue({ isValid: true }), execute: jest.fn(), dryRun: jest.fn().mockReturnValue({ actionType: 'ADD_ORDER_NOTE', index: 0, description: 'Not eklenecek' }) } },
        { provide: NotificationHandler, useValue: { type: 'SEND_NOTIFICATION', validateConfig: jest.fn().mockReturnValue({ isValid: true }), execute: jest.fn(), dryRun: jest.fn().mockReturnValue({ actionType: 'SEND_NOTIFICATION', index: 0, description: 'Bildirim gönderilecek' }) } },
        { provide: WebhookHandler, useValue: { type: 'CALL_WEBHOOK', validateConfig: jest.fn().mockReturnValue({ isValid: true }), execute: jest.fn(), dryRun: jest.fn().mockReturnValue({ actionType: 'CALL_WEBHOOK', index: 0, description: 'Webhook tetiklenecek' }) } },
        { provide: WaitHandler, useValue: { type: 'WAIT', validateConfig: jest.fn().mockReturnValue({ isValid: true }), execute: jest.fn(), dryRun: jest.fn().mockReturnValue({ actionType: 'WAIT', index: 0, description: 'Bekletilecek' }) } },
      ],
    }).compile();

    service = module.get(OrderAutomationService);
    jest.clearAllMocks();
  });

  it('servis tanımlı olmalı', () => {
    expect(service).toBeDefined();
  });

  describe('Katalog', () => {
    it('katalog triggers, fields, operators ve actions listelemeli', () => {
      const catalog = service.getCatalog();
      expect(catalog.triggers.length).toBeGreaterThan(0);
      expect(catalog.fields.length).toBeGreaterThan(0);
      expect(catalog.operators.length).toBeGreaterThan(0);
      expect(catalog.actions.length).toBeGreaterThan(0);
    });
  });

  describe('Kurallar CRUD ve Kiracı İzolasyonu', () => {
    it('findAll sadece geçerli kiracının kurallarını sorgulamalı', async () => {
      mockPrisma.automationRule.findMany.mockResolvedValue([]);
      await service.findAll(scope);

      expect(mockPrisma.automationRule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            agencyId: 'agency-1',
            storeId: 'store-1',
            deletedAt: null,
          }),
        }),
      );
    });

    it('findOne başka kiracının kuralında NotFoundException fırlatmalı', async () => {
      mockPrisma.automationRule.findFirst.mockResolvedValue(null);
      await expect(service.findOne('other-rule', scope)).rejects.toThrow(NotFoundException);
    });

    it('create geçerli bir kural oluşturup versiyon 1 kaydetmeli', async () => {
      const dto: CreateAutomationRuleDto = {
        name: 'VIP Kuralı',
        triggerType: 'ORDER_CREATED',
        conditions: {
          version: 1,
          operator: 'and',
          conditions: [
            { field: 'totalAmount', operator: 'gte', value: 1000 },
          ],
        },
        actions: [
          { type: 'ADD_TAG', config: { tag: 'VIP' } },
        ],
        isActive: true,
      };

      const createdRule = { id: 'rule-new', ...dto, version: 1 };
      mockPrisma.automationRule.create.mockResolvedValue(createdRule);
      mockPrisma.automationRuleVersion.create.mockResolvedValue({});

      const result = await service.create(dto, scope, actor);
      expect(result).toBeDefined();
      expect(mockPrisma.automationRule.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            agencyId: 'agency-1',
            storeId: 'store-1',
            name: 'VIP Kuralı',
          }),
        }),
      );
      expect(mockPrisma.automationRuleVersion.create).toHaveBeenCalled();
    });

    it('boş aksiyon listesiyle kural oluşturulursa BadRequestException fırlatmalı', async () => {
      const dto: any = {
        name: 'Hatalı Kural',
        triggerType: 'ORDER_CREATED',
        conditions: { version: 1, operator: 'and', conditions: [] },
        actions: [],
      };

      await expect(service.create(dto, scope, actor)).rejects.toThrow(BadRequestException);
    });
  });

  describe('Simülasyon (dryRunTest)', () => {
    it('dryRun koşul eşleşmesini ve planlanan aksiyonları doğru hesaplamalı', async () => {
      const mockOrder = {
        id: 'order-123',
        orderNumber: 'ORD-123',
        storeId: 'store-1',
        totalAmount: 1500,
        status: 'PENDING',
        customerCity: 'İstanbul',
        shippingCity: 'İstanbul',
        items: [],
      };
      mockPrisma.order.findFirst.mockResolvedValue(mockOrder);

      const testDto = {
        orderId: 'order-123',
        rule: {
          name: 'Test DryRun',
          triggerType: 'ORDER_CREATED' as const,
          conditions: {
            version: 1 as const,
            operator: 'and' as const,
            conditions: [
              { field: 'totalAmount', operator: 'gte' as const, value: 1000 },
            ],
          },
          actions: [
            { type: 'ADD_TAG', config: { tag: 'VIP' } },
          ],
        },
      };

      const result = await service.dryRunTest(testDto, scope);
      expect(result.matched).toBe(true);
      expect(result.plannedActions.length).toBe(1);
      expect(result.plannedActions[0].actionType).toBe('ADD_TAG');
    });
  });
});
