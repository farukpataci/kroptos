import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';

@Injectable()
export class StockSourceService {
  constructor(private prisma: PrismaService) {}

  async findAll(agencyId: string) {
    return [];
  }

  async findOne(id: string, agencyId: string) {
    return null;
  }

  async create(data: any, agencyId: string) {
    return { success: true };
  }

  async update(id: string, data: any, agencyId: string) {
    return { success: true };
  }

  async remove(id: string, agencyId: string) {
    return { success: true };
  }
}
