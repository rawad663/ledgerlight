import { Module } from '@nestjs/common';
import { PrismaModule } from '@src/infra/prisma/prisma.module';
import { StripeModule } from '@src/infra/stripe/stripe.module';
import { PaymentController } from './payment.controller';
import { PaymentWebhookController } from './payment-webhook.controller';
import { PaymentService } from './payment.service';

@Module({
  imports: [PrismaModule, StripeModule],
  controllers: [PaymentController, PaymentWebhookController],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}
