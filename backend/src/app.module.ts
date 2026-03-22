import { MiddlewareConsumer, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { RequestContextMiddleware } from '@src/common/middlewares/request-context.middleware';
import { HealthModule } from '@src/domain/health/health.module';
import { AuthModule } from '@src/domain/auth/auth.module';
import { CustomerModule } from '@src/domain/customer/customer.module';
import { ProductModule } from '@src/domain/product/product.module';
import { InventoryModule } from '@src/domain/inventory/inventory.module';
import { OrderModule } from '@src/domain/order/order.module';

import { PrismaModule } from './infra/prisma/prisma.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    CustomerModule,
    ProductModule,
    InventoryModule,
    OrderModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
