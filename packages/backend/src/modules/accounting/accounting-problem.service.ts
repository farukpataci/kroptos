import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@common/prisma/prisma.service';

/** Problem kuyruğu (docs/mikro.agent.md §9.7) — her sorguda tenant filtresi. */
@Injectable()
export class AccountingProblemService {
  constructor(private readonly prisma: PrismaService) {}

  list(agencyId: string, filter: { integrationId?: string; includeResolved?: boolean }) {
    return this.prisma.accountingProblem.findMany({
      where: {
        agencyId,
        ...(filter.integrationId ? { integrationId: filter.integrationId } : {}),
        ...(filter.includeResolved ? {} : { resolvedAt: null }),
      },
      orderBy: [{ severity: 'desc' }, { lastSeenAt: 'desc' }],
      take: 200,
    });
  }

  async resolve(agencyId: string, id: string, by: string) {
    const row = await this.prisma.accountingProblem.findFirst({ where: { id, agencyId } });
    if (!row) throw new NotFoundException('Problem kaydı bulunamadı');
    return this.prisma.accountingProblem.update({ where: { id }, data: { resolvedAt: new Date(), resolvedBy: by } });
  }
}
