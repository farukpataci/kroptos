import { Module } from '@nestjs/common';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { HealthController } from './health/health.controller';
import { ProductsExampleController } from './products-example/products-example.controller';

@Module({
  imports: [DatabaseModule, AuditModule, AuthModule],
  controllers: [HealthController, ProductsExampleController],
})
export class AppModule {}
