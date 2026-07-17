import { Module, Global } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { SignedUrlService } from '../services/signed-url.service';
import { TenantGuard } from '../guards/tenant.guard';

@Global()
@Module({
  providers: [PrismaService, SignedUrlService, TenantGuard],
  exports: [PrismaService, SignedUrlService, TenantGuard],
})
export class PrismaModule {}
