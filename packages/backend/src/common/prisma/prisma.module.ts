import { Module, Global } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { SignedUrlService } from '../services/signed-url.service';

@Global()
@Module({
  providers: [PrismaService, SignedUrlService],
  exports: [PrismaService, SignedUrlService],
})
export class PrismaModule {}
