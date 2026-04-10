import 'reflect-metadata';

// Default envs for tests
process.env.JWT_ACCESS_SECRET = process.env.JWT_ACCESS_SECRET || 'test-secret';
process.env.STRIPE_SECRET_KEY =
  process.env.STRIPE_SECRET_KEY || 'sk_test_mocked_secret';
process.env.STRIPE_WEBHOOK_SECRET =
  process.env.STRIPE_WEBHOOK_SECRET || 'whsec_mocked_secret';
