import { AsyncLocalStorage } from 'node:async_hooks';

export type StructuredLogLevel = 'info' | 'warn' | 'error';

export interface StructuredLogCorrelationContext {
  requestId?: string;
  caseId?: string;
  iterationId?: string;
  agentName?: string;
  jobId?: string;
  [key: string]: unknown;
}

export interface StructuredLogEntry {
  timestamp: string;
  level: StructuredLogLevel;
  event: string;
  message: string;
  context: Record<string, unknown>;
}

export interface StructuredLogger {
  info(
    event: string,
    message: string,
    context?: Record<string, unknown>,
  ): void;
  warn(
    event: string,
    message: string,
    context?: Record<string, unknown>,
  ): void;
  error(
    event: string,
    message: string,
    context?: Record<string, unknown>,
  ): void;
  child(context: Record<string, unknown>): StructuredLogger;
}

export interface StructuredLoggerOptions {
  now?: () => Date;
  context?: Record<string, unknown>;
  write?: (line: string, entry: StructuredLogEntry) => void;
}

const structuredLogContextStorage =
  new AsyncLocalStorage<StructuredLogCorrelationContext>();

export function createStructuredLogger(
  options: StructuredLoggerOptions = {},
): StructuredLogger {
  const now = options.now ?? (() => new Date());
  const baseContext = options.context ?? {};
  const write =
    options.write ??
    ((line: string) => {
      console.log(line);
    });

  const log = (
    level: StructuredLogLevel,
    event: string,
    message: string,
    context: Record<string, unknown> = {},
  ) => {
    const activeContext = structuredLogContextStorage.getStore() ?? {};
    const entry: StructuredLogEntry = {
      timestamp: now().toISOString(),
      level,
      event,
      message,
      context: {
        ...baseContext,
        ...activeContext,
        ...context,
      },
    };

    write(JSON.stringify(entry), entry);
  };

  return {
    info(event, message, context) {
      log('info', event, message, context);
    },
    warn(event, message, context) {
      log('warn', event, message, context);
    },
    error(event, message, context) {
      log('error', event, message, context);
    },
    child(context) {
      return createStructuredLogger({
        now,
        write,
        context: {
          ...baseContext,
          ...context,
        },
      });
    },
  };
}

export function runWithStructuredLogContext<T>(
  context: StructuredLogCorrelationContext,
  callback: () => T,
): T {
  const activeContext = structuredLogContextStorage.getStore() ?? {};
  return structuredLogContextStorage.run(
    {
      ...activeContext,
      ...context,
    },
    callback,
  );
}

export function createNoopStructuredLogger(): StructuredLogger {
  return {
    info() {},
    warn() {},
    error() {},
    child() {
      return createNoopStructuredLogger();
    },
  };
}
