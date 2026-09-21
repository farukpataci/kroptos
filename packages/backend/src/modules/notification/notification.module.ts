import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { NotificationDispatcher } from './notification-dispatcher';
import { NotificationProviderService } from './notification-provider.service';
import { NotificationLogController, NotificationProviderController } from './notification.controller';
import { NotificationService } from './notification.service';

/**
 * Gönderim tarafı: kuyruk ('notifications'), sağlayıcı adaptörleri, dispatcher
 * (orderEvents dinleyicisi), günlük ve sağlayıcı uçları. Şablon CRUD'u
 * NotificationTemplateModule'de; o bu modülü import eder.
 */
@Module({
  imports: [PrismaModule, ConfigModule, AuditModule],
  controllers: [NotificationLogController, NotificationProviderController],
  providers: [NotificationService, NotificationProviderService, NotificationDispatcher],
  exports: [NotificationService, NotificationProviderService],
})
export class NotificationModule {}
