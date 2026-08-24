import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service';
import { Order, Prisma, Shipment, ShipmentPackage, ShipmentTrackingEvent } from '@prisma/client';
import { generatePublicId } from '../../common/utils/id-generator';
import { CarrierConnector } from '../../integrations/carriers/core/CarrierConnector';
import {
  CancelResult,
  CarrierAddress,
  CarrierTrackingResult,
  CarrierLabel,
  isShipmentStatus,
  LabelFormat,
  RateQuote,
  ShipmentProblem,
  STUCK_CLAIM_MINUTES,
} from '../../integrations/carriers/core/CarrierTypes';
import { DEFAULT_DESI_DIVISOR, measureParcels } from '../../integrations/carriers/core/DesiCalculator';
import { OrderService } from '../order/order.service';
import { CarrierIntegrationService } from './carrier-integration.service';
import {
  CancelShipmentDto,
  CreateShipmentDto,
  CreateShipmentForOrderDto,
  ListShipmentsQueryDto,
  QuoteShipmentDto,
} from './dto/shipment.dto';
import { requireStore, TenantScope } from './tenant-scope';

@Injectable()
export class ShipmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly carriers: CarrierIntegrationService,
    private readonly orders: OrderService,
  ) {}

  /**
   * Tenant filter for every shipment query. `agencyId` always applies; the
   * store and client narrow it further when the request carries that context.
   */
  private scopeWhere(scope: TenantScope): Prisma.ShipmentWhereInput {
    return {
      agencyId: scope.agencyId,
      deletedAt: null,
      ...(scope.storeId ? { storeId: scope.storeId } : {}),
      ...(scope.clientId ? { clientId: scope.clientId } : {}),
    };
  }

  /**
   * Swallows only the duplicate-event violation.
   *
   * A blanket `catch(() => undefined)` hid every write failure: a timeline that
   * silently stopped filling looked exactly like a clean sync, while the status
   * column kept moving. Anything that is not the expected duplicate is a real
   * failure and belongs in the caller's face.
   */
  private ignoreDuplicateEvent(error: unknown): void {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return;
    throw error;
  }

  /** Prisma hands back Decimal; JSON should carry a number, not an object. */
  private num(value: Prisma.Decimal | null): number | null {
    return value == null ? null : Number(value);
  }

  /**
   * What the list endpoint returns, field for field — see ShipmentResponseDto.
   *
   * Sender and recipient addresses are dropped here on purpose. The table does
   * not render them, and a paged list is the widest KVKK exposure in the module:
   * one call with pageSize=200 would hand out two hundred customers' names,
   * phones and addresses. The detail endpoint still serves them to an operator
   * who deliberately opened one shipment.
   */
  private toListItem(row: Shipment) {
    return {
      id: row.id,
      publicId: row.publicId,
      provider: row.provider,
      status: row.status,
      carrierStatusCode: row.carrierStatusCode,
      trackingNumber: row.trackingNumber,
      barcode: row.barcode,
      orderId: row.orderId,
      referenceCode: row.referenceCode,
      serviceLevel: row.serviceLevel,
      paymentType: row.paymentType,
      codAmount: this.num(row.codAmount),
      codCurrency: row.codCurrency,
      totalDesi: this.num(row.totalDesi),
      totalWeightKg: this.num(row.totalWeightKg),
      chargeableWeightKg: this.num(row.chargeableWeightKg),
      labelFormat: row.labelFormat,
      isTestMode: row.isTestMode,
      handedOverAt: row.handedOverAt,
      deliveredAt: row.deliveredAt,
      cancelledAt: row.cancelledAt,
      // These two only mean anything as a pair: an error with no carrier
      // confirmation is a barcode still live at the carrier, billable, waiting
      // for someone to close it from the carrier's own panel. Left out of the
      // projection it cannot be seen at all.
      carrierCancelledAt: row.carrierCancelledAt,
      carrierCancelError: row.carrierCancelError,
      createdAt: row.createdAt,
    };
  }

  /**
   * The where clause behind each problem bucket. Written once so the list
   * filter and the counter cannot drift apart about what "stuck" means.
   */
  private problemWhere(problem: ShipmentProblem): Prisma.ShipmentWhereInput {
    if (problem === 'stuck_claim') {
      return {
        status: 'created',
        trackingNumber: null,
        createdAt: { lt: new Date(Date.now() - STUCK_CLAIM_MINUTES * 60_000) },
      };
    }
    // Cancelled here, not at the carrier: the barcode is live and will be billed.
    return { carrierCancelError: { not: null }, carrierCancelledAt: null };
  }

  /**
   * The counts a dashboard needs. Both buckets are tenant-scoped like every
   * other read; a KPI that leaked across tenants would be worse than no KPI.
   */
  async problemCounts(scope: TenantScope) {
    const [stuckClaims, carrierCancelFailed] = await Promise.all([
      this.prisma.shipment.count({
        where: { ...this.scopeWhere(scope), ...this.problemWhere('stuck_claim') },
      }),
      this.prisma.shipment.count({
        where: { ...this.scopeWhere(scope), ...this.problemWhere('carrier_cancel_failed') },
      }),
    ]);

    return {
      stuckClaims,
      carrierCancelFailed,
      total: stuckClaims + carrierCancelFailed,
      stuckClaimAfterMinutes: STUCK_CLAIM_MINUTES,
    };
  }

  /**
   * The search clause for `q`.
   *
   * The order number is not a column on Shipment — there is no relation to
   * follow, only `orderId` — so the matching orders are looked up first, under
   * the same tenant scope. Scoping that lookup is the whole point: without it
   * an order number belonging to another agency would resolve to ids, and this
   * clause would then be the only thing standing between a caller and rows the
   * outer filter was meant to hide.
   */
  private async searchWhere(
    scope: TenantScope,
    term: string,
  ): Promise<Prisma.ShipmentWhereInput[]> {
    const contains = { contains: term, mode: 'insensitive' as const };

    const orders = await this.prisma.order.findMany({
      where: {
        agencyId: scope.agencyId,
        deletedAt: null,
        ...(scope.storeId ? { storeId: scope.storeId } : {}),
        ...(scope.clientId ? { clientId: scope.clientId } : {}),
        OR: [{ orderNumber: contains }, { marketplaceOrderNumber: contains }],
      },
      select: { id: true },
      // A short term matches a lot of orders; the cap keeps the IN list sane.
      // Operators search for a number they are holding, not for a prefix.
      take: 200,
    });

    return [
      { trackingNumber: contains },
      { barcode: contains },
      { referenceCode: contains },
      ...(orders.length ? [{ orderId: { in: orders.map((order) => order.id) } }] : []),
    ];
  }

  async list(scope: TenantScope, query: ListShipmentsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;
    const term = query.q?.trim();

    const where: Prisma.ShipmentWhereInput = {
      ...this.scopeWhere(scope),
      ...(query.status ? { status: query.status } : {}),
      ...(query.provider ? { provider: query.provider.toUpperCase() } : {}),
      ...(query.problem ? this.problemWhere(query.problem as ShipmentProblem) : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lt: new Date(query.to) } : {}),
            },
          }
        : {}),
      ...(term ? { OR: await this.searchWhere(scope, term) } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.shipment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.shipment.count({ where }),
    ]);

    return { items: items.map((row) => this.toListItem(row)), total, page, pageSize };
  }

  /**
   * The detail payload: the list fields plus the parcels and the timeline.
   *
   * Still no sender or recipient address. The rule is per response, not per
   * endpoint — the detail call is not a narrower audience, just a narrower
   * query, and an operator who needs the delivery address reads it from the
   * order, behind the permission that guards it there.
   *
   * The events are projected field by field for the same reason. `description`
   * is the carrier's own free text and can name whoever signed for the parcel;
   * it stays because a timeline without descriptions is useless, but nothing in
   * the row carries the phone or the address this projection exists to withhold.
   */
  private toDetail(
    row: Shipment & { packages: ShipmentPackage[]; events: ShipmentTrackingEvent[] },
  ) {
    return {
      ...this.toListItem(row),
      packages: row.packages.map((parcel) => ({
        id: parcel.id,
        barcode: parcel.barcode,
        weightKg: this.num(parcel.weightKg),
        lengthCm: this.num(parcel.lengthCm),
        widthCm: this.num(parcel.widthCm),
        heightCm: this.num(parcel.heightCm),
        desi: this.num(parcel.desi),
        chargeableWeightKg: this.num(parcel.chargeableWeightKg),
        contentDescription: parcel.contentDescription,
      })),
      events: row.events.map((event) => ({
        id: event.id,
        status: event.status,
        carrierStatusCode: event.carrierStatusCode,
        description: event.description,
        location: event.location,
        occurredAt: event.occurredAt,
      })),
    };
  }

  async get(id: string, scope: TenantScope) {
    const shipment = await this.prisma.shipment.findFirst({
      where: { ...this.scopeWhere(scope), id },
      include: {
        packages: true,
        events: { orderBy: { occurredAt: 'desc' } },
      },
    });
    if (!shipment) throw new NotFoundException(`Gönderi bulunamadı: ${id}`);
    return this.toDetail(shipment);
  }

  /** Same lookup without the relations, for the operations that only act. */
  private async findOrFail(id: string, scope: TenantScope) {
    const shipment = await this.prisma.shipment.findFirst({
      where: { ...this.scopeWhere(scope), id },
    });
    if (!shipment) throw new NotFoundException(`Gönderi bulunamadı: ${id}`);
    return shipment;
  }

  /**
   * Idempotency key. One order must not end up with two barcodes, so a caller
   * that supplies nothing still gets a stable key derived from the order.
   */
  private baseReferenceFor(dto: CreateShipmentDto): string {
    return dto.orderId ?? `orderNo:${dto.orderNumber}`;
  }

  /** Every shipment this order has had, whatever state it is in. */
  private priorShipmentWhere(
    agencyId: string,
    storeId: string,
    dto: CreateShipmentDto,
  ): Prisma.ShipmentWhereInput {
    const base = this.baseReferenceFor(dto);
    return {
      agencyId,
      storeId,
      deletedAt: null,
      ...(dto.orderId ? { orderId: dto.orderId } : { referenceCode: { startsWith: base } }),
    };
  }

  /**
   * The shipment that still counts as this order's. A cancelled one does not:
   * an order whose label was voided has to be shippable again.
   */
  private findLiveShipment(agencyId: string, storeId: string, dto: CreateShipmentDto) {
    return this.prisma.shipment.findFirst({
      where: {
        ...this.priorShipmentWhere(agencyId, storeId, dto),
        status: { not: 'cancelled' },
      },
      include: { packages: true },
    });
  }

  /**
   * `<orderId>` for the first attempt, then `<orderId>:2`, `:3` … after each
   * cancellation. A caller that supplies its own code keeps it verbatim.
   */
  private async nextReferenceCode(
    agencyId: string,
    storeId: string,
    dto: CreateShipmentDto,
  ): Promise<string> {
    if (dto.referenceCode) return dto.referenceCode;

    const base = this.baseReferenceFor(dto);
    // Cancelled attempts only.
    //
    // Counting live rows too made the suffix depend on when this request read
    // the table: two concurrent calls for the same order both pass the "no live
    // shipment" check, then the slower one counts the faster one's claim and
    // computes `<order>:2` — a different reference code, so the unique index
    // has nothing to catch and the order gets a second barcode. The six-way race
    // test caught it twice in five runs; six runs after this change, never.
    //
    // With cancelled rows alone the key is the same for both, the loser hits
    // P2002 and is handed the winner. The suffix still does its job: a
    // cancelled attempt keeps its number and the next attempt gets the next.
    const cancelled = await this.prisma.shipment.count({
      where: { ...this.priorShipmentWhere(agencyId, storeId, dto), status: 'cancelled' },
    });

    return cancelled === 0 ? base : `${base}:${cancelled + 1}`;
  }

  /**
   * The tenant's desi tariff, per carrier connection. It is resolved here and
   * nowhere else — a connector that guesses 3000 for a 5000-tariff customer
   * bills every parcel wrong, and the error only shows up on the invoice.
   */
  private divisorFor(integration: { settings: unknown }): number {
    const settings = (integration.settings ?? {}) as Record<string, unknown>;
    return Number(settings.desiDivisor) || DEFAULT_DESI_DIVISOR;
  }

  async create(dto: CreateShipmentDto, scope: TenantScope) {
    const storeId = requireStore(scope);
    const integration = await this.carriers.findOneOrFail(dto.carrierIntegrationId, scope);

    if (!integration.isActive) {
      throw new BadRequestException(`${integration.displayName} bağlantısı pasif.`);
    }

    // Idempotent by contract: a second call for the same order returns the
    // shipment that already exists instead of buying a second barcode.
    const existing = await this.findLiveShipment(scope.agencyId, storeId, dto);
    if (existing) return existing;

    const sender = (dto.sender ?? integration.senderAddress) as CarrierAddress | null;
    if (!sender) {
      throw new BadRequestException(
        'Gönderici adresi yok: istekte belirtin veya taşıyıcı bağlantısına varsayılan adres tanımlayın.',
      );
    }

    const settings = (integration.settings ?? {}) as Record<string, unknown>;
    const divisor = this.divisorFor(integration);
    const measured = measureParcels(dto.parcels, divisor);

    const referenceCode = await this.nextReferenceCode(scope.agencyId, storeId, dto);

    // The row is written BEFORE the carrier is called, carrying no tracking
    // number yet. It is a claim on the reference code: whoever loses the unique
    // constraint never reaches the carrier, so a race costs one barcode rather
    // than two. Reading first and then writing cannot do this — both readers
    // see an empty table and both buy.
    let claim;
    try {
      claim = await this.prisma.shipment.create({
        data: {
          publicId: generatePublicId('shp'),
          agencyId: scope.agencyId,
          clientId: scope.clientId,
          storeId,
          orderId: dto.orderId ?? null,
          carrierIntegrationId: integration.id,
          provider: integration.provider,
          status: 'created',
          serviceLevel: dto.serviceLevel ?? null,
          paymentType: dto.paymentType,
          codAmount: dto.codAmount ?? null,
          codCurrency: dto.codCurrency ?? null,
          totalDesi: measured.totalDesi,
          totalWeightKg: measured.totalWeightKg,
          // The billed figure, stored because reconciling the carrier's invoice
          // later would otherwise need the divisor that applied on that day.
          chargeableWeightKg: measured.chargeableWeightKg,
          notes: dto.notes ?? null,
          labelFormat: (settings.labelFormat as string) ?? 'PDF',
          referenceCode,
          // Test shipments carry the flag so live reports can exclude them.
          isTestMode: integration.isTestMode,
          senderAddress: sender as unknown as Prisma.InputJsonValue,
          recipientAddress: dto.recipient as unknown as Prisma.InputJsonValue,
          packages: {
            create: measured.parcels.map((parcel) => ({
              agencyId: scope.agencyId,
              weightKg: parcel.weightKg,
              lengthCm: parcel.lengthCm,
              widthCm: parcel.widthCm,
              heightCm: parcel.heightCm,
              desi: parcel.desi,
              chargeableWeightKg: parcel.chargeableWeightKg,
              contentDescription: parcel.contentDescription ?? null,
            })),
          },
        },
        include: { packages: true },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002' &&
        // Only the reference-code claim is a race we can answer; a duplicate
        // tracking number means something else entirely.
        !String(error.meta?.target ?? '').includes('trackingNumber')
      ) {
        const winner = await this.prisma.shipment.findFirst({
          where: { agencyId: scope.agencyId, storeId, referenceCode, deletedAt: null },
          include: { packages: true },
        });
        if (winner) return winner;
      }
      throw error;
    }

    // Not caught: an ambiguous carrier failure (a timeout may still have bought
    // a barcode) must leave the claim row behind as evidence. It stays at
    // 'created' with no tracking number, and cancelling it frees the order for
    // a fresh attempt under the next reference code.
    const connector = this.carriers.connectorFor(integration);
    const result = await connector.createShipment({
      orderId: dto.orderId ?? '',
      orderNumber: dto.orderNumber,
      sender,
      recipient: dto.recipient as CarrierAddress,
      parcels: measured.parcels,
      desiDivisor: divisor,
      paymentType: dto.paymentType as any,
      codAmount: dto.codAmount,
      codCurrency: dto.codCurrency,
      serviceLevel: dto.serviceLevel as any,
      referenceCode,
      notes: dto.notes,
    });

    return this.prisma.shipment.update({
      where: { id: claim.id },
      data: {
        trackingNumber: result.trackingNumber,
        barcode: result.barcode ?? null,
        labelUrl: result.labelUrl ?? null,
        status: 'label_ready',
      },
      include: { packages: true },
    });
  }

  /**
   * The recipient, built from the order's own structured columns.
   *
   * The free-text `shippingAddress` is not consulted. A courier sorts by
   * district and no parser gets that out of one line reliably enough to put a
   * parcel on the right van, so a missing column is named rather than guessed
   * at.
   *
   * fullName and phone fall back to the buyer's, which is not a guess — an
   * order with no separate recipient is delivered to the person who placed it.
   * Nothing else has a fallback.
   */
  recipientFrom(order: Order): CarrierAddress {
    const fullName = order.shippingFullName?.trim() || order.customerName?.trim() || '';
    const phone = order.shippingPhone?.trim() || order.customerPhone?.trim() || '';

    const fields: Record<string, string> = {
      shippingFullName: fullName,
      shippingPhone: phone,
      shippingLine1: order.shippingLine1?.trim() || '',
      shippingDistrict: order.shippingDistrict?.trim() || '',
      shippingCity: order.shippingCity?.trim() || '',
      shippingCountryCode: order.shippingCountryCode?.trim() || '',
    };

    const missing = Object.entries(fields)
      .filter(([, value]) => !value)
      .map(([name]) => name);

    if (missing.length > 0) {
      throw new BadRequestException({
        code: 'INCOMPLETE_SHIPPING_ADDRESS',
        messageKey: 'shipping.errors.incompleteAddress',
        message: `Siparisin kargo adresi eksik: ${missing.join(', ')}`,
        missingFields: missing,
      });
    }

    return {
      fullName: fields.shippingFullName,
      phone: fields.shippingPhone,
      line1: fields.shippingLine1,
      line2: order.shippingLine2?.trim() || undefined,
      district: fields.shippingDistrict,
      city: fields.shippingCity,
      postalCode: order.shippingPostalCode?.trim() || undefined,
      countryCode: fields.shippingCountryCode,
    };
  }

  /**
   * One order in, one shipment out — the whole path a packing station uses.
   *
   * This is the only body behind both bulk endpoints and the WMS label. They
   * used to be two implementations of the same five steps, and two
   * implementations drift: the day one of them starts accepting an address from
   * the caller, the other is still reading it off the order.
   *
   * The tenant scope is built from the ORDER, not from the request headers.
   * `agencyId` still comes from the validated context and the order is looked
   * up inside it, but the store is the order's own — a packer working at agency
   * level would otherwise have to switch stores between two parcels on the same
   * bench.
   */
  async createForOrder(agencyId: string, dto: CreateShipmentForOrderDto) {
    const order = await this.prisma.order.findFirst({
      where: { id: dto.orderId, agencyId, deletedAt: null },
    });
    if (!order) {
      throw new NotFoundException(`Siparis bulunamadi: ${dto.orderId}`);
    }

    if (dto.paymentType === 'cod' && !dto.codAmount) {
      throw new BadRequestException(
        'Kapida odeme icin codAmount zorunludur: tahsil edilecek tutar bilinmeden etiket basilamaz.',
      );
    }

    const recipient = this.recipientFrom(order);
    const scope: TenantScope = { agencyId, clientId: order.clientId, storeId: order.storeId };

    // Throws NO_ACTIVE_CARRIER or AMBIGUOUS_CARRIER rather than picking one.
    const integration = await this.carriers.resolveCarrierIntegration(
      scope,
      dto.carrierIntegrationId,
    );

    // Idempotent by order: a second request for the same order returns the
    // shipment that already exists instead of buying a second barcode.
    const shipment = await this.create(
      {
        carrierIntegrationId: integration.id,
        orderId: order.id,
        orderNumber: order.orderNumber,
        recipient: recipient as any,
        parcels: dto.parcels,
        paymentType: dto.paymentType ?? 'sender_pays',
        codAmount: dto.codAmount,
        codCurrency: dto.codCurrency ?? (dto.paymentType === 'cod' ? order.currency : undefined),
        serviceLevel: dto.serviceLevel,
      } as any,
      scope,
    );

    return { order, integration, shipment };
  }

  /**
   * A packing round.
   *
   * Sequential and deliberately not transactional: every item buys a barcode
   * from a carrier, and a rollback cannot un-buy one. An order that succeeded
   * keeps its barcode even when the next order fails, and each failure is
   * reported against its own order so the packer can see which parcels are
   * ready.
   */
  async createForOrders(agencyId: string, items: CreateShipmentForOrderDto[]) {
    const results: {
      orderId: string;
      success: boolean;
      shipment?: unknown;
      error?: { code?: string; message: string };
    }[] = [];

    for (const item of items) {
      try {
        const { shipment } = await this.createForOrder(agencyId, item);
        results.push({ orderId: item.orderId, success: true, shipment });
      } catch (error: any) {
        // The structured refusals (NO_ACTIVE_CARRIER, AMBIGUOUS_CARRIER,
        // INCOMPLETE_SHIPPING_ADDRESS) keep their code: a screen acts on the
        // code, not on a Turkish sentence.
        const body = error?.response ?? {};
        results.push({
          orderId: item.orderId,
          success: false,
          error: {
            code: body.code,
            message: body.message ?? error?.message ?? 'Gonderi olusturulamadi.',
          },
        });
      }
    }

    return {
      created: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      results,
    };
  }

  /**
   * Label bytes, behind the same permission check as the shipment itself. The
   * carrier's own label URL is never handed to the browser — it is usually
   * unauthenticated and enumerable.
   */
  async getLabel(id: string, scope: TenantScope, format: LabelFormat): Promise<CarrierLabel> {
    const shipment = await this.findOrFail(id, scope);
    if (!shipment.trackingNumber) {
      throw new BadRequestException('Gönderinin takip numarası yok, etiket üretilemez.');
    }

    // includeDeleted: the barcode outlives the connection it was bought from.
    const integration = await this.carriers.findOneOrFail(
      shipment.carrierIntegrationId ?? '',
      scope,
      { includeDeleted: true },
    );
    return this.carriers.connectorFor(integration).getLabel(shipment.trackingNumber, format);
  }

  /**
   * The parcels a courier is taking, marked as gone.
   *
   * Per shipment rather than in one `updateMany`: the refusals are the point.
   * A barcode-less claim has nothing for the courier to scan and a cancelled
   * shipment must not leave the building, so both are reported by id instead of
   * being silently swept into the count. Everything else in the batch still
   * goes.
   *
   * Idempotent: a parcel already handed over keeps its original timestamp. The
   * manifest is printed and signed from the returned rows, and reprinting it
   * must not restate when the van left.
   */
  async handover(scope: TenantScope, shipmentIds: string[]) {
    const rows = await this.prisma.shipment.findMany({
      where: { ...this.scopeWhere(scope), id: { in: shipmentIds } },
    });
    const found = new Map(rows.map((row) => [row.id, row]));

    const handedOver: Awaited<ReturnType<ShipmentService['toListItem']>>[] = [];
    const refused: { id: string; code: string; message: string }[] = [];
    const now = new Date();

    for (const id of shipmentIds) {
      const row = found.get(id);
      if (!row) {
        refused.push({
          id,
          code: 'NOT_FOUND',
          message: 'Gönderi bu kiracıda bulunamadı.',
        });
        continue;
      }
      if (row.status === 'cancelled') {
        refused.push({
          id,
          code: 'SHIPMENT_CANCELLED',
          message: `${row.barcode ?? row.publicId} iptal edilmiş, kuryeye verilemez.`,
        });
        continue;
      }
      if (!row.barcode && !row.trackingNumber) {
        refused.push({
          id,
          code: 'SHIPMENT_WITHOUT_BARCODE',
          message: `${row.publicId} için barkod yok; kuryenin okutacağı bir şey olmadan teslim edilemez.`,
        });
        continue;
      }

      if (row.handedOverAt) {
        handedOver.push(this.toListItem(row));
        continue;
      }

      const updated = await this.prisma.shipment.update({
        where: { id: row.id },
        data: { status: 'handed_over', handedOverAt: now },
      });

      // An internal event, with the KROPTOS_ prefix the schema reserves for
      // them: the timeline should show when the parcel left us, not start at
      // the carrier's first scan.
      await this.prisma.shipmentTrackingEvent
        .create({
          data: {
            shipmentId: row.id,
            agencyId: scope.agencyId,
            status: 'handed_over',
            carrierStatusCode: 'KROPTOS_HANDOVER',
            description: 'Kuryeye teslim edildi (manifesto)',
            occurredAt: now,
          },
        })
        .catch((error) => this.ignoreDuplicateEvent(error));

      handedOver.push(this.toListItem(updated));
    }

    return { handedOverAt: now, handedOver, refused };
  }

  /**
   * Two steps, deliberately independent.
   *
   * 1. Ask the carrier to void the barcode — skipped when there is no tracking
   *    number, which is exactly the stuck-claim case an operator has to clear.
   * 2. Cancel on our side regardless of what step 1 answered.
   *
   * The carrier owning its barcode does not give it a veto over our order
   * state: a refusal that blocks the cancel leaves the order unshippable
   * forever, the worse failure by far. The refusal is recorded in
   * `carrierCancelError` and `carrierCancelledAt` stays empty, so a barcode
   * that may still be live shows up as a chase instead of being assumed void.
   */
  async cancel(
    id: string,
    scope: TenantScope,
    dto: CancelShipmentDto,
  ): Promise<CancelResult & { carrierCancelled: boolean }> {
    const shipment = await this.findOrFail(id, scope);
    if (shipment.status === 'cancelled') {
      return {
        success: true,
        carrierCancelled: shipment.carrierCancelledAt != null,
        message: 'Gönderi zaten iptal edilmiş.',
      };
    }

    let carrierCancelled = false;
    let carrierError: string | null = null;
    let trackingNumber = shipment.trackingNumber;
    let recoveredTracking: string | null = null;

    // Resolved once, for both branches below. A failure here is recorded rather
    // than thrown: losing the connector must not stop us closing our own side.
    let connector: CarrierConnector | null = null;
    if (trackingNumber || shipment.referenceCode) {
      try {
        const integration = await this.carriers.findOneOrFail(
          shipment.carrierIntegrationId ?? '',
          scope,
          { includeDeleted: true },
        );
        connector = this.carriers.connectorFor(integration);
      } catch (error: any) {
        carrierError = error?.message ?? 'Taşıyıcı bağlantısı çözülemedi.';
      }
    }

    // A claim row whose createShipment timed out carries no tracking number,
    // but the timeout may well have bought a barcode. Ask the carrier with our
    // own reference before concluding there is nothing to void. Carriers that
    // cannot be queried by reference simply do not implement this, and the
    // shipment closes on our side alone.
    if (!trackingNumber && shipment.referenceCode && connector?.findByReference) {
      try {
        const found = await connector.findByReference(shipment.referenceCode);
        if (found?.trackingNumber) {
          trackingNumber = found.trackingNumber;
          recoveredTracking = found.trackingNumber;
        }
      } catch (error: any) {
        // The lookup failing leaves us unable to prove the barcode does not
        // exist. The cancel still succeeds; the doubt is written down so the
        // possibly-live barcode gets chased by hand.
        carrierError = error?.message ?? 'Taşıyıcı referans sorgusu başarısız oldu.';
      }
    }

    if (trackingNumber && connector) {
      try {
        const result = await connector.cancelShipment(trackingNumber);
        carrierCancelled = result.success;
        if (!result.success) {
          carrierError = result.message ?? 'Taşıyıcı iptal isteğini reddetti.';
        }
      } catch (error: any) {
        carrierError = error?.message ?? 'Taşıyıcı iptal isteği başarısız oldu.';
      }
    }

    const now = new Date();
    await this.prisma.shipment.update({
      where: { id: shipment.id },
      data: {
        status: 'cancelled',
        cancelledAt: now,
        carrierCancelledAt: carrierCancelled ? now : null,
        carrierCancelError: carrierError,
        // Recovered from the carrier: the barcode existed after all, and the
        // row must show it whether or not the void itself succeeded.
        ...(recoveredTracking ? { trackingNumber: recoveredTracking } : {}),
      },
    });

    await this.prisma.shipmentTrackingEvent
      .create({
        data: {
          shipmentId: shipment.id,
          agencyId: scope.agencyId,
          status: 'cancelled',
          // Internal event: no carrier code exists, but the column is part of
          // the dedupe key, so it gets an explicit KROPTOS_* one.
          carrierStatusCode: carrierError ? 'KROPTOS_CANCEL_CARRIER_FAILED' : 'KROPTOS_CANCELLED',
          description:
            dto.reason ??
            (carrierError
              ? `Gönderi iptal edildi; taşıyıcı iptali başarısız: ${carrierError}`
              : 'Gönderi iptal edildi'),
          occurredAt: now,
        },
      })
      // The cancellation already happened; a duplicate timeline row must not
      // turn a completed cancel into an error. Anything else still surfaces —
      // cancel is idempotent, so a retry is safe and beats a lost timeline.
      .catch((error) => this.ignoreDuplicateEvent(error));

    return {
      success: true,
      carrierCancelled,
      message: carrierError
        ? `Gönderi KroptOS tarafında iptal edildi, taşıyıcı tarafında edilemedi: ${carrierError}`
        : 'Gönderi iptal edildi.',
    };
  }

  /**
   * Writes one carrier answer onto one shipment.
   *
   * Shared by the manual refresh below and the scheduled sweep, which cannot
   * call `refresh` itself: the sweep asks each carrier about every parcel in
   * one `track([...])` call, and going through `refresh` would turn that back
   * into one HTTP request per shipment.
   *
   * Nothing is written when the carrier's answer fails the guard — that is the
   * caller's cue to leave this shipment exactly as it was.
   */
  async applyTracking(
    shipment: Shipment,
    tracking: CarrierTrackingResult,
    scope: TenantScope,
    providerLabel: string,
    /**
     * Who to record on the order transition this poll may cause. An operator
     * pressing refresh has a real id; the sweep has none and names itself
     * instead, so the audit row says which machine moved the order.
     */
    actor: { userId?: string; label: string },
  ): Promise<void> {
    // Checked before a single row is written, and for the events too: a mapper
    // that leaks the carrier's own code must not get half its poll persisted.
    // The loud failure is the point — an unrecognised code quietly written to
    // `status` would eventually be an order closed as 'delivered' that never
    // arrived.
    const unmapped = [tracking, ...tracking.events].find((item) => !isShipmentStatus(item.status));
    if (unmapped) {
      throw new BadRequestException(
        `${providerLabel} normalize edilmemiş bir gönderi durumu döndürdü: ` +
          `"${String(unmapped.status)}" (taşıyıcı kodu: ${tracking.carrierStatusCode ?? '-'}). ` +
          'Mapper düzeltilmeden gönderi durumu güncellenmez.',
      );
    }

    for (const event of tracking.events) {
      // Duplicate deliveries of the same event are expected; the composite
      // unique makes reprocessing a no-op instead of a doubled timeline.
      await this.prisma.shipmentTrackingEvent
        .create({
          data: {
            shipmentId: shipment.id,
            agencyId: scope.agencyId,
            status: event.status,
            // The event's own code, not the shipment-level one: the unique key
            // is built from it, so one code for the whole poll would keep the
            // first event and silently drop the rest.
            carrierStatusCode: event.carrierStatusCode,
            description: event.description,
            location: event.location ?? null,
            occurredAt: event.at,
          },
        })
        .catch((error) => this.ignoreDuplicateEvent(error));
    }

    await this.prisma.shipment.update({
      where: { id: shipment.id },
      data: {
        // Normalised status only. The carrier's own code lives beside it.
        status: tracking.status,
        carrierStatusCode: tracking.carrierStatusCode ?? null,
        deliveredAt: tracking.deliveredAt ?? shipment.deliveredAt,
      },
    });

    // Only on the transition. Polling a delivered parcel again must not add a
    // second timeline row saying it was delivered again.
    if (tracking.deliveredAt && shipment.orderId && !shipment.deliveredAt) {
      // Through the order service, not prisma.order.update: the status change
      // owes an OrderTimeline row and an audit entry, and both live in there.
      await this.orders.updateStatus(
        shipment.orderId,
        { status: 'delivered' },
        actor.userId,
        scope.agencyId,
        scope.clientId ?? undefined,
        scope.storeId ?? undefined,
        undefined,
        undefined,
        actor.label,
      );
    }
  }

  /**
   * Pulls the carrier's current state for one shipment — the manual path an
   * operator triggers. The scheduled sweep is CarrierTrackingWorker.
   */
  async refresh(id: string, scope: TenantScope, userId?: string) {
    const shipment = await this.findOrFail(id, scope);
    if (!shipment.trackingNumber) {
      throw new BadRequestException('Takip numarası olmayan gönderi sorgulanamaz.');
    }

    const integration = await this.carriers.findOneOrFail(
      shipment.carrierIntegrationId ?? '',
      scope,
      { includeDeleted: true },
    );
    const [tracking] = await this.carriers
      .connectorFor(integration)
      .track([shipment.trackingNumber]);

    // Projected, not the raw row: the carrier answering nothing is not a reason
    // to hand the caller senderAddress, recipientAddress and Decimal objects
    // that every other response on this controller withholds.
    if (tracking) {
      await this.applyTracking(shipment, tracking, scope, integration.provider, {
        userId,
        label: 'shipment-refresh',
      });
    }

    // The detail projection, so the caller gets the events this poll just wrote
    // — and so this endpoint withholds the addresses like every other one.
    return this.get(id, scope);
  }

  /**
   * Price comparison across the tenant's own carrier connections. Carriers
   * without a rating endpoint are skipped rather than guessed at.
   */
  async quote(dto: QuoteShipmentDto, scope: TenantScope): Promise<RateQuote[]> {
    const quotes: RateQuote[] = [];

    for (const id of dto.carrierIntegrationIds) {
      const integration = await this.carriers.findOneOrFail(id, scope);
      if (!integration.isActive) continue;
      if (integration.isTestMode && !dto.includeTestMode) continue;

      const connector = this.carriers.connectorFor(integration);
      if (!connector.getRates) continue;

      const sender = (dto.sender ?? integration.senderAddress) as CarrierAddress | null;
      if (!sender) continue;

      const divisor = this.divisorFor(integration);
      const measured = measureParcels(dto.parcels, divisor);
      quotes.push(
        ...(await connector.getRates({
          sender,
          recipient: dto.recipient as CarrierAddress,
          parcels: measured.parcels,
          desiDivisor: divisor,
          paymentType: dto.paymentType as any,
          serviceLevel: dto.serviceLevel as any,
        })),
      );
    }

    return quotes.sort((a, b) => a.amount - b.amount);
  }
}
