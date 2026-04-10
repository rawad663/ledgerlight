import { Module } from '@nestjs/common';
import { PrismaModule } from '@src/infra/prisma/prisma.module';
import { InventoryModule } from '@src/domain/inventory/inventory.module';
import { PaymentModule } from '@src/domain/payment/payment.module';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';

@Module({
  imports: [PrismaModule, InventoryModule, PaymentModule],
  controllers: [OrderController],
  providers: [OrderService],
})
export class OrderModule {}
