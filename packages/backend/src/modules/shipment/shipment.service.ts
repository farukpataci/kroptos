import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { generatePublicId } from '../../common/utils/id-generator';
import {
  CancelResult,
  CarrierAddress,
  CarrierLabel,
  LabelFormat,
  RateQuote,
} from '../../integrations/carriers/core/CarrierTypes';
import { DEFAULT_DESI_DIVISOR, measureParcels } from '../../integrations/carriers/core/DesiCalculator';
import { CarrierIntegrationService } from './carrier-integration.service';
import {
  CancelShipmentDto,
  CreateShipmentDto,
  ListShipmentsQueryDto,
  QuoteShipmentDto,
} from './dto/shipment.dto';
import { requireStore, TenantScope } from './tenant-scope';

@Injectable()
export class ShipmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly carriers: CarrierIntegrationService,
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

  async list(scope: TenantScope, query: ListShipmentsQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;

    const where: Prisma.ShipmentWhereInput = {
      ...this.scopeWhere(scope),
      ...(query.status ? { status: query.status } : {}),
      ...(query.provider ? { provider: query.provider.toUpperCase() } : {}),
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lt: new Date(query.to) } : {}),
            },
          }
        : {}),
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

    return { items, total, page, pageSize };
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
    return shipment;
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

  /**
   * How many shipments this order has already had, cancelled ones included.
   * The count drives the reference suffix, so a cancelled attempt still
   * occupies its number and the next one cannot collide with it.
   */
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
    const prior = await this.prisma.shipment.count({
      where: this.priorShipmentWhere(agencyId, storeId, dto),
    });

    return prior === 0 ? base : `${base}:${prior + 1}`;
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
   * Packing station batch. Each shipment is independent, so one rejected
   * address must not sink the other forty-nine — failures come back per item.
   */
  async createBulk(shipments: CreateShipmentDto[], scope: TenantScope) {
    const results: Array<{ orderNumber: string; shipment?: unknown; error?: string }> = [];

    for (const dto of shipments) {
      try {
        results.push({ orderNumber: dto.orderNumber, shipment: await this.create(dto, scope) });
      } catch (error: any) {
        results.push({ orderNumber: dto.orderNumber, error: error?.message ?? 'Bilinmeyen hata' });
      }
    }

    return {
      created: results.filter((r) => r.shipment).length,
      failed: results.filter((r) => r.error).length,
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

    const integration = await this.carriers.findOneOrFail(shipment.carrierIntegrationId ?? '', scope);
    return this.carriers.connectorFor(integration).getLabel(shipment.trackingNumber, format);
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

    if (shipment.trackingNumber) {
      try {
        const integration = await this.carriers.findOneOrFail(
          shipment.carrierIntegrationId ?? '',
          scope,
        );
        const result = await this.carriers
          .connectorFor(integration)
          .cancelShipment(shipment.trackingNumber);

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
      // turn a completed cancel into an error for the operator.
      .catch(() => undefined);

    return {
      success: true,
      carrierCancelled,
      message: carrierError
        ? `Gönderi KroptOS tarafında iptal edildi, taşıyıcı tarafında edilemedi: ${carrierError}`
        : 'Gönderi iptal edildi.',
    };
  }

  /**
   * Pulls the carrier's current state for one shipment. The scheduled batch
   * sync does not exist yet; this is the manual path an operator triggers.
   */
  async refresh(id: string, scope: TenantScope) {
    const shipment = await this.findOrFail(id, scope);
    if (!shipment.trackingNumber) {
      throw new BadRequestException('Takip numarası olmayan gönderi sorgulanamaz.');
    }

    const integration = await this.carriers.findOneOrFail(shipment.carrierIntegrationId ?? '', scope);
    const [tracking] = await this.carriers
      .connectorFor(integration)
      .track([shipment.trackingNumber]);

    if (!tracking) return shipment;

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
        .catch(() => undefined);
    }

    return this.prisma.shipment.update({
      where: { id: shipment.id },
      data: {
        // Normalised status only. The carrier's own code lives beside it.
        status: tracking.status,
        carrierStatusCode: tracking.carrierStatusCode ?? null,
        deliveredAt: tracking.deliveredAt ?? shipment.deliveredAt,
      },
    });
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
        })),
      );
    }

    return quotes.sort((a, b) => a.amount - b.amount);
  }
}
