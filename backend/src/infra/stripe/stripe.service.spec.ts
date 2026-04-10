import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { StripeService } from './stripe.service';

const mockStripeClient = {
  paymentIntents: {
    create: jest.fn(),
    retrieve: jest.fn(),
    cancel: jest.fn(),
  },
  refunds: {
    create: jest.fn(),
  },
  webhooks: {
    constructEvent: jest.fn(),
  },
};

jest.mock('stripe', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(function mockStripeConstructor() {
    Object.assign(this, mockStripeClient);
  }),
}));

describe('StripeService', () => {
  let service: StripeService;
  let configService: { getOrThrow: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockStripeClient.paymentIntents.create.mockReset();
    mockStripeClient.paymentIntents.retrieve.mockReset();
    mockStripeClient.paymentIntents.cancel.mockReset();
    mockStripeClient.refunds.create.mockReset();
    mockStripeClient.webhooks.constructEvent.mockReset();

    configService = {
      getOrThrow: jest.fn((key: string) => {
        if (key === 'STRIPE_SECRET_KEY') {
          return 'sk_test_123';
        }

        if (key === 'STRIPE_WEBHOOK_SECRET') {
          return 'whsec_123';
        }

        throw new Error(`Unexpected config lookup: ${key}`);
      }),
    };

    const module = await Test.createTestingModule({
      providers: [
        StripeService,
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get(StripeService);
    (service as any).stripeClient = mockStripeClient;
  });

  it('constructs the Stripe client with the configured secret and API version', () => {
    expect(Stripe).toHaveBeenCalledWith('sk_test_123', {
      apiVersion: '2026-03-25.dahlia',
    });
    expect(configService.getOrThrow).toHaveBeenCalledWith('STRIPE_SECRET_KEY');
    expect(configService.getOrThrow).toHaveBeenCalledWith(
      'STRIPE_WEBHOOK_SECRET',
    );
  });

  it('creates a payment intent with normalized currency and optional idempotency key', async () => {
    mockStripeClient.paymentIntents.create.mockResolvedValue({
      id: 'pi_123',
    });

    await service.createPaymentIntent({
      amountCents: 2500,
      currencyCode: 'CAD',
      metadata: { orderId: 'order-1' },
      idempotencyKey: 'idem-1',
    });

    expect(mockStripeClient.paymentIntents.create).toHaveBeenCalledWith(
      {
        amount: 2500,
        currency: 'cad',
        payment_method_types: ['card'],
        metadata: { orderId: 'order-1' },
      },
      { idempotencyKey: 'idem-1' },
    );
  });

  it('creates a payment intent without request options when no idempotency key is provided', async () => {
    mockStripeClient.paymentIntents.create.mockResolvedValue({
      id: 'pi_456',
    });

    await service.createPaymentIntent({
      amountCents: 1800,
      currencyCode: 'usd',
    });

    expect(mockStripeClient.paymentIntents.create).toHaveBeenCalledWith(
      {
        amount: 1800,
        currency: 'usd',
        payment_method_types: ['card'],
        metadata: undefined,
      },
      undefined,
    );
  });

  it('retrieves a payment intent by id', async () => {
    mockStripeClient.paymentIntents.retrieve.mockResolvedValue({
      id: 'pi_123',
    });

    await service.retrievePaymentIntent('pi_123');

    expect(mockStripeClient.paymentIntents.retrieve).toHaveBeenCalledWith(
      'pi_123',
    );
  });

  it('cancels a payment intent by id', async () => {
    mockStripeClient.paymentIntents.cancel.mockResolvedValue({
      id: 'pi_123',
    });

    await service.cancelPaymentIntent('pi_123');

    expect(mockStripeClient.paymentIntents.cancel).toHaveBeenCalledWith(
      'pi_123',
    );
  });

  it('creates a refund with optional metadata and idempotency key', async () => {
    mockStripeClient.refunds.create.mockResolvedValue({
      id: 're_123',
    });

    await service.createRefund({
      paymentIntentId: 'pi_123',
      metadata: { orderId: 'order-1' },
      idempotencyKey: 'refund-idem-1',
    });

    expect(mockStripeClient.refunds.create).toHaveBeenCalledWith(
      {
        payment_intent: 'pi_123',
        metadata: { orderId: 'order-1' },
      },
      { idempotencyKey: 'refund-idem-1' },
    );
  });

  it('creates a refund without request options when no idempotency key is provided', async () => {
    mockStripeClient.refunds.create.mockResolvedValue({
      id: 're_456',
    });

    await service.createRefund({
      paymentIntentId: 'pi_456',
    });

    expect(mockStripeClient.refunds.create).toHaveBeenCalledWith(
      {
        payment_intent: 'pi_456',
        metadata: undefined,
      },
      undefined,
    );
  });

  it('constructs a webhook event with the stored webhook secret', () => {
    const payload = Buffer.from('payload');

    service.constructWebhookEvent(payload, 'signature-123');

    expect(mockStripeClient.webhooks.constructEvent).toHaveBeenCalledWith(
      payload,
      'signature-123',
      'whsec_123',
    );
  });
});
