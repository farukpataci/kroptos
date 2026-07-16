import { Module } from '@nestjs/common';
import { ProductService } from './product.service';
import { ProductController } from './product.controller';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { IntegrationModule } from '../integration/integration.module';

@Module({
  imports: [PrismaModule, IntegrationModule],
  controllers: [ProductController],
  providers: [ProductService],
  exports: [ProductService],
})
export class ProductModule {}
