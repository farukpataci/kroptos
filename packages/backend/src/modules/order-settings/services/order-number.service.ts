import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service';
import { OrderSettingsDto } from '../dto/order-settings.dto';
import { generatePublicId } from '@common/utils/id-generator';

@Injectable()
export class OrderNumberService {
  private readonly logger = new Logger(OrderNumberService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates the next atomic, collision-free order number.
   */
  async generateNextOrderNumber(
    storeId: string,
    agencyId: string,
    settings: OrderSettingsDto,
    isMarketplace = false,
  ): Promise<string> {
    const series =
      settings.numbering.separateMarketplaceSeries && isMarketplace ? 'MARKETPLACE' : 'DEFAULT';

    const now = new Date();
    const period = this.computePeriod(settings.numbering.resetPeriod, now);

    // Initial sequence value (if row does not exist yet)
    const minSeq = Math.max(1, settings.numbering.nextSequence || 1);

    // Atomically upsert and increment
    const rawResult: Array<{ current: number }> = await this.prisma.$queryRawUnsafe(
      `
      INSERT INTO "OrderNumberSequence" ("id", "agencyId", "storeId", "series", "period", "current", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT ("storeId", "series", "period")
      DO UPDATE SET "current" = GREATEST("OrderNumberSequence"."current" + 1, $6), "updatedAt" = NOW()
      RETURNING "current";
      `,
      generatePublicId('seq', 12),
      agencyId,
      storeId,
      series,
      period,
      minSeq,
    );

    const currentSeq = rawResult[0]?.current ?? minSeq;

    return this.formatNumber(
      settings.numbering.pattern,
      settings.numbering.prefix,
      settings.numbering.suffix,
      settings.numbering.padding,
      currentSeq,
      now,
    );
  }

  /**
   * Formats a preview of what the next order number will look like.
   */
  async previewOrderNumber(
    storeId: string,
    settings: OrderSettingsDto,
    overrideConfig?: Partial<OrderSettingsDto['numbering']>,
  ): Promise<{ nextNumber: string; currentSequence: number; period: string }> {
    const numbering = {
      ...settings.numbering,
      ...(overrideConfig || {}),
    };

    const now = new Date();
    const period = this.computePeriod(numbering.resetPeriod, now);
    const series = 'DEFAULT';

    const seqRow = await this.prisma.orderNumberSequence.findUnique({
      where: {
        storeId_series_period: {
          storeId,
          series,
          period,
        },
      },
    });

    const nextSeq = seqRow ? seqRow.current + 1 : Math.max(1, numbering.nextSequence || 1);

    const nextNumber = this.formatNumber(
      numbering.pattern,
      numbering.prefix,
      numbering.suffix,
      numbering.padding,
      nextSeq,
      now,
    );

    return {
      nextNumber,
      currentSequence: seqRow?.current ?? 0,
      period,
    };
  }

  private computePeriod(resetPeriod: string, date: Date): string {
    const yyyy = date.getFullYear().toString();
    const mm = (date.getMonth() + 1).toString().padStart(2, '0');

    if (resetPeriod === 'MONTHLY') {
      return `${yyyy}-${mm}`;
    }
    if (resetPeriod === 'YEARLY') {
      return yyyy;
    }
    return 'GLOBAL';
  }

  public formatNumber(
    pattern: string,
    prefix: string,
    suffix: string,
    padding: number,
    sequence: number,
    date: Date = new Date(),
  ): string {
    const yyyy = date.getFullYear().toString();
    const yy = yyyy.slice(-2);
    const mm = (date.getMonth() + 1).toString().padStart(2, '0');
    const dd = date.getDate().toString().padStart(2, '0');
    const seqStr = sequence.toString().padStart(padding, '0');

    let result = pattern
      .replace(/\{PREFIX\}/g, prefix || '')
      .replace(/\{SUFFIX\}/g, suffix || '')
      .replace(/\{YYYY\}/g, yyyy)
      .replace(/\{YY\}/g, yy)
      .replace(/\{MM\}/g, mm)
      .replace(/\{DD\}/g, dd)
      .replace(/\{SEQ\}/g, seqStr);

    // Clean up any double dashes or stray leading/trailing dashes if prefix/suffix was blank
    result = result
      .replace(/--+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '');

    return result;
  }
}
