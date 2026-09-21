import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { AgencyModule } from './modules/agency/agency.module';
import { ClientModule } from './modules/client/client.module';
import { StoreModule } from './modules/store/store.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { InvitationModule } from './modules/invitation/invitation.module';
import { ProductModule } from './modules/product/product.module';
import { CategoryModule } from './modules/category/category.module';
import { OrderModule } from './modules/order/order.module';
import { IntegrationModule } from './modules/integration/integration.module';
import { IntegrationSettingsModule } from './modules/integration-settings/integration-settings.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { TenantMiddleware } from './common/middleware/tenant.middleware';
import { RlsContextMiddleware } from './common/middleware/rls-context.middleware';
import { RlsBindInterceptor } from './common/interceptors/rls-bind.interceptor';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AgentModule } from './modules/agent/agent.module';
import { WmsModule } from './modules/wms/wms.module';
import { ShipmentModule } from './modules/shipment/shipment.module';
import { NotificationModule } from './modules/notification/notification.module';
import { NotificationTemplateModule } from './modules/notification-template/notification-template.module';
import { AuditModule } from './modules/audit/audit.module';
import { IntegrationLogModule } from './modules/integration-log/integration-log.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { SettingsModule } from './modules/settings/settings.module';
import { WarehouseSettingsModule } from './modules/warehouse-settings/warehouse-settings.module';
import { ProfileModule } from './modules/profile/profile.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { AccountingModule } from './modules/accounting/accounting.module';
import { FilesController } from './modules/files/files.controller';
import { HealthController } from './modules/health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    AuthModule,
    AgencyModule,
    ClientModule,
    StoreModule,
    RbacModule,
    InvitationModule,
    ProductModule,
    CategoryModule,
    OrderModule,
    IntegrationModule,
    IntegrationSettingsModule,
    WmsModule,
    ShipmentModule,
    NotificationModule,
    NotificationTemplateModule,
    AuditModule,
    IntegrationLogModule,
    AnalyticsModule,
    SettingsModule,
    WarehouseSettingsModule,
    ProfileModule,
    InventoryModule,
    AccountingModule,
    AgentModule,
  ],
  controllers: [FilesController, HealthController],
  // RLS (P12 Adım 2): guard'lardan sonra istek bağlamını kiracıya bağlar.
  providers: [{ provide: APP_INTERCEPTOR, useClass: RlsBindInterceptor }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // RLS bağlam kapsayıcısı TenantMiddleware'den ÖNCE açılır (pre-auth = sistem bağlamı).
    consumer.apply(RlsContextMiddleware, TenantMiddleware).forRoutes('*');
  }
}
