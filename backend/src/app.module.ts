import { MiddlewareConsumer, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';

import { RequestContextMiddleware } from '@src/common/middlewares/request-context.middleware';
import { MonitoringModule } from '@src/common/monitoring/monitoring.module';
import { HealthModule } from '@src/domain/health/health.module';
import { AuthModule } from '@src/domain/auth/auth.module';
import { CustomerModule } from '@src/domain/customer/customer.module';
import { ProductModule } from '@src/domain/product/product.module';
import { InventoryModule } from '@src/domain/inventory/inventory.module';
import { OrderModule } from '@src/domain/order/order.module';
import { AuditLogModule } from '@src/domain/audit-log/audit-log.module';
import { LocationModule } from '@src/domain/location/location.module';
import { DashboardModule } from '@src/domain/dashboard/dashboard.module';
import { TeamModule } from '@src/domain/team/team.module';
import { PaymentModule } from '@src/domain/payment/payment.module';
import { resolveBackendEnvFilePaths } from '@src/config/runtime-env';

import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: resolveBackendEnvFilePaths(),
    }),
    ThrottlerModule.forRoot({
      // 100 requests per 60s
      throttlers: [{ name: 'default', ttl: 60000, limit: 100 }],
    }),
    MonitoringModule,
    HealthModule,
    AuthModule,
    CustomerModule,
    ProductModule,
    LocationModule,
    InventoryModule,
    OrderModule,
    PaymentModule,
    AuditLogModule,
    DashboardModule,
    TeamModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
