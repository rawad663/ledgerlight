import {
  BadRequestException,
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Request } from 'express';
import { StripeService } from '@src/infra/stripe/stripe.service';
import { PaymentService } from './payment.service';

type StripeWebhookRequest = Request & {
  rawBody?: Buffer;
};

@ApiExcludeController()
@Controller('payments/webhooks')
export class PaymentWebhookController {
  constructor(
    private readonly paymentService: PaymentService,
    private readonly stripeService: StripeService,
  ) {}

  @Post('stripe')
  @HttpCode(200)
  async handleStripeWebhook(
    @Req() req: StripeWebhookRequest,
    @Headers('stripe-signature') signature?: string,
  ) {
    if (!signature) {
      throw new BadRequestException('Missing Stripe signature');
    }

    if (!req.rawBody) {
      throw new BadRequestException('Missing Stripe webhook payload');
    }

    let event;
    try {
      event = this.stripeService.constructWebhookEvent(req.rawBody, signature);
    } catch {
      throw new BadRequestException('Invalid Stripe webhook signature');
    }

    switch (event.type) {
      case 'payment_intent.succeeded':
      case 'payment_intent.payment_failed':
      case 'payment_intent.processing':
      case 'payment_intent.canceled':
        await this.paymentService.handleWebhookPaymentIntent(
          event.id,
          event.type,
          event.data.object as Parameters<
            PaymentService['handleWebhookPaymentIntent']
          >[2],
        );
        break;
      case 'refund.created':
      case 'refund.updated':
      case 'refund.failed':
        await this.paymentService.handleWebhookRefund(
          event.id,
          event.type,
          event.data.object as Parameters<
            PaymentService['handleWebhookRefund']
          >[2],
        );
        break;
      default:
        break;
    }

    return { received: true };
  }
}
