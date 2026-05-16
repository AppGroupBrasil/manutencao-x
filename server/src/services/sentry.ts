import type { Express } from 'express';

let initialized = false;
let SentryRef: any = null;

export async function initSentry(app: Express): Promise<void> {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  try {
    const Sentry = await import('@sentry/node');
    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: Number.parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
      release: process.env.SENTRY_RELEASE,
    });
    Sentry.setupExpressErrorHandler(app);
    SentryRef = Sentry;
    initialized = true;
    console.log('[SENTRY] Inicializado.');
  } catch (err: any) {
    console.warn('[SENTRY] Falha ao inicializar (ignorando):', err.message);
  }
}

export function captureException(err: unknown, context?: Record<string, any>) {
  if (!initialized || !SentryRef) return;
  try {
    if (context) SentryRef.setContext('extras', context);
    SentryRef.captureException(err);
  } catch {}
}
