import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { PrismaInstrumentation } from '@prisma/instrumentation';

const tracesEndpoint =
  process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ??
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT;

if (process.env.OTEL_SDK_DISABLED !== 'true' && tracesEndpoint) {
  if (process.env.OTEL_LOG_LEVEL === 'debug') {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
  }

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      'service.name': process.env.OTEL_SERVICE_NAME ?? 'ledger-light-backend',
      'deployment.environment':
        process.env.LEDGERLIGHT_ENV ?? process.env.NODE_ENV ?? 'unknown',
    }),
    traceExporter: new OTLPTraceExporter({
      url: tracesEndpoint,
    }),
    instrumentations: [
      getNodeAutoInstrumentations(),
      new PrismaInstrumentation(),
    ],
  });

  sdk.start();

  const shutdown = () => {
    void sdk.shutdown().catch(() => undefined);
  };

  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);
}

export {};
