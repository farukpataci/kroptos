import { Module } from '@nestjs/common';
import { RbacService } from './rbac.service';
import { RbacController } from './rbac.controller';
import { PrismaModule } from '@common/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [RbacController],
  providers: [RbacService],
  exports: [RbacService],
})
export class RbacModule {}
