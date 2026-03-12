import { describe, expect, it } from 'vitest';

import {
  createNoopStructuredLogger,
  createStructuredLogger,
  runWithStructuredLogContext,
} from '../src/index.js';

describe('structured logger', () => {
  it('writes JSON log entries with merged child context', () => {
    const lines: string[] = [];
    const logger = createStructuredLogger({
      now: () => new Date('2026-03-12T00:00:00.000Z'),
      context: {
        service: 'gateway-api',
      },
      write(line) {
        lines.push(line);
      },
    }).child({
      caseId: 'case-1',
    });

    logger.info('case.created', 'Created a new opportunity case.', {
      status: 'TOPIC_ACCEPTED',
    });

    expect(lines).toEqual([
      JSON.stringify({
        timestamp: '2026-03-12T00:00:00.000Z',
        level: 'info',
        event: 'case.created',
        message: 'Created a new opportunity case.',
        context: {
          service: 'gateway-api',
          caseId: 'case-1',
          status: 'TOPIC_ACCEPTED',
        },
      }),
    ]);
  });

  it('supports a no-op logger for tests and silent paths', () => {
    const logger = createNoopStructuredLogger();

    expect(() =>
      logger.error('ignored', 'This should not throw.', {
        anything: true,
      }),
    ).not.toThrow();
  });

  it('merges async correlation context into nested log entries', async () => {
    const lines: string[] = [];
    const logger = createStructuredLogger({
      now: () => new Date('2026-03-12T00:00:00.000Z'),
      write(line) {
        lines.push(line);
      },
    });

    await runWithStructuredLogContext(
      {
        requestId: 'req-1',
      },
      async () => {
        await Promise.resolve();
        logger.child({
          caseId: 'case-1',
        }).info('case.started', 'Started processing a case.', {
          jobId: 'job-1',
        });
      },
    );

    expect(lines).toEqual([
      JSON.stringify({
        timestamp: '2026-03-12T00:00:00.000Z',
        level: 'info',
        event: 'case.started',
        message: 'Started processing a case.',
        context: {
          caseId: 'case-1',
          requestId: 'req-1',
          jobId: 'job-1',
        },
      }),
    ]);
  });
});
