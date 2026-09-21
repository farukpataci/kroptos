import { Module, Global } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { SignedUrlService } from '../services/signed-url.service';
import { PermissionCacheService } from '../services/permission-cache.service';

@Global()
@Module({
  providers: [PrismaService, SignedUrlService, PermissionCacheService],
  exports: [PrismaService, SignedUrlService, PermissionCacheService],
})
export class PrismaModule {}
