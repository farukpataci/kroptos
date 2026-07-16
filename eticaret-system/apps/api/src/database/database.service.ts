import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { db } from 'eticaret-system-database';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  readonly client = db;

  async onModuleDestroy() {
    await this.client.$disconnect();
  }
}
