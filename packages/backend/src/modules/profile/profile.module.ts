import { AuthModule } from '../auth/auth.module';
import { Module } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { PrismaModule } from '@common/prisma/prisma.module';
import { AuditModule } from '@modules/audit/audit.module';
import { RbacModule } from '../rbac/rbac.module';

@Module({
  imports: [AuthModule, PrismaModule, AuditModule, RbacModule],
  controllers: [ProfileController],
  providers: [ProfileService],
  exports: [ProfileService],
})
export class ProfileModule {}
