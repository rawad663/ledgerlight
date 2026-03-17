import { Module } from '@nestjs/common';
import { PrismaModule } from '@src/infra/prisma/prisma.module';
import { InventoryModule } from '@src/domain/inventory/inventory.module';
import { ProductController } from './product.controller';
import { ProductService } from './product.service';

@Module({
  imports: [PrismaModule, InventoryModule],
  controllers: [ProductController],
  providers: [ProductService],
})
export class ProductModule {}
