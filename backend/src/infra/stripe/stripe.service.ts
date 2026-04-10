import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private readonly stripeClient: InstanceType<typeof Stripe>;
  private readonly webhookSecret: string;

  constructor(private readonly configService: ConfigService) {
    const secretKey =
      this.configService.getOrThrow<string>('STRIPE_SECRET_KEY');

    this.webhookSecret = this.configService.getOrThrow<string>(
      'STRIPE_WEBHOOK_SECRET',
    );

    this.stripeClient = new Stripe(secretKey, {
      apiVersion: '2026-03-25.dahlia',
    });
  }

  createPaymentIntent(args: {
    amountCents: number;
    currencyCode: string;
    metadata?: Record<string, string>;
    idempotencyKey?: string;
  }) {
    return this.stripeClient.paymentIntents.create(
      {
        amount: args.amountCents,
        currency: args.currencyCode.toLowerCase(),
        payment_method_types: ['card'],
        metadata: args.metadata,
      },
      args.idempotencyKey ? { idempotencyKey: args.idempotencyKey } : undefined,
    );
  }

  retrievePaymentIntent(id: string) {
    return this.stripeClient.paymentIntents.retrieve(id);
  }

  cancelPaymentIntent(id: string) {
    return this.stripeClient.paymentIntents.cancel(id);
  }

  createRefund(args: {
    paymentIntentId: string;
    metadata?: Record<string, string>;
    idempotencyKey?: string;
  }) {
    return this.stripeClient.refunds.create(
      {
        payment_intent: args.paymentIntentId,
        metadata: args.metadata,
      },
      args.idempotencyKey ? { idempotencyKey: args.idempotencyKey } : undefined,
    );
  }

  constructWebhookEvent(payload: Buffer, signature: string) {
    return this.stripeClient.webhooks.constructEvent(
      payload,
      signature,
      this.webhookSecret,
    );
  }
}
