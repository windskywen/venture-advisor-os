import { EventEmitter } from 'node:events';

import { describe, expect, it } from 'vitest';

import {
  createStructuredLogger,
  type StructuredLogEntry,
} from '@venture-advisor-os/shared-types';

import { registerWorkflowQueueFailureLogging } from '../src/index.js';

class FakeQueueEvents extends EventEmitter {
  override on(eventName: string, listener: (...args: unknown[]) => void): this {
    return super.on(eventName, listener);
  }

  override off(eventName: string, listener: (...args: unknown[]) => void): this {
    return super.off(eventName, listener);
  }
}

describe('workflow queue logging', () => {
  it('logs queue failures with queue name and job metadata', () => {
    const entries: StructuredLogEntry[] = [];
    const events = {
      caseStart: new FakeQueueEvents(),
      agentRun: new FakeQueueEvents(),
      caseReview: new FakeQueueEvents(),
      reportRender: new FakeQueueEvents(),
      prdGeneration: new FakeQueueEvents(),
      pocGeneration: new FakeQueueEvents(),
    };
    const logger = createStructuredLogger({
      now: () => new Date('2026-03-12T00:00:00.000Z'),
      write(_line, entry) {
        entries.push(entry);
      },
    });

    const unregister = registerWorkflowQueueFailureLogging(events, logger);
    events.agentRun.emit('failed', {
      jobId: 'job-123',
      failedReason: 'schema validation failed',
      prev: 'active',
    });
    unregister();
    events.agentRun.emit('failed', {
      jobId: 'job-456',
      failedReason: 'should not be logged',
      prev: 'active',
    });

    expect(entries).toEqual([
      {
        timestamp: '2026-03-12T00:00:00.000Z',
        level: 'error',
        event: 'workflow.queue.failed',
        message: 'A workflow queue job failed.',
        context: {
          queueName: 'agentRun',
          jobId: 'job-123',
          failedReason: 'schema validation failed',
          previousStatus: 'active',
        },
      },
    ]);
  });
});
