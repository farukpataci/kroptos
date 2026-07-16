import { Controller, Get } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Controller('health')
export class HealthController {
  constructor(private readonly database: DatabaseService) {}

  @Get()
  health() {
    return { status: 'ok' };
  }

  @Get('db')
  async databaseHealth() {
    await this.database.client.$queryRaw`SELECT 1`;
    return { status: 'ok', database: 'connected' };
  }
}
