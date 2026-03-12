import { describe, expect, it } from 'vitest';

import {
  createStructuredLogger,
  type StructuredLogEntry,
} from '@venture-advisor-os/shared-types';

import {
  getFailureRetryPolicy,
  resolveFailureHandling,
} from '../src/index.js';

describe('failure retry policy', () => {
  it('retries transient infrastructure failures up to three times', () => {
    expect(
      resolveFailureHandling({
        category: 'INFRA_FAILURE',
        retryCount: 0,
      }),
    ).toMatchObject({
      shouldRetry: true,
      nextAction: 'RETRY',
      maxRetryCount: 3,
    });

    expect(
      resolveFailureHandling({
        category: 'INFRA_FAILURE',
        retryCount: 3,
      }),
    ).toMatchObject({
      shouldRetry: false,
      nextAction: 'FAIL_CASE',
      manualReviewRequiredAfterExhaustion: true,
    });
  });

  it('retries malformed output once with a stricter formatting reminder', () => {
    const policy = getFailureRetryPolicy('MALFORMED_OUTPUT');
    const retryResolution = resolveFailureHandling({
      category: 'MALFORMED_OUTPUT',
      retryCount: 0,
    });
    const exhaustedResolution = resolveFailureHandling({
      category: 'MALFORMED_OUTPUT',
      retryCount: 1,
    });

    expect(policy.useStricterFormattingReminderOnRetry).toBe(true);
    expect(retryResolution.nextAction).toBe('RETRY');
    expect(exhaustedResolution.nextAction).toBe('FAIL_CASE');
  });

  it('routes normalization and schema failures directly to manual review', () => {
    expect(
      resolveFailureHandling({
        category: 'NORMALIZATION_FAILURE',
        retryCount: 0,
      }),
    ).toMatchObject({
      shouldRetry: false,
      nextAction: 'MANUAL_REVIEW',
    });

    expect(
      resolveFailureHandling({
        category: 'SCHEMA_VALIDATION_FAILURE',
        retryCount: 0,
      }),
    ).toMatchObject({
      shouldRetry: false,
      nextAction: 'MANUAL_REVIEW',
    });
  });

  it('blocks workflow advancement for storage failures and judge dead-ends', () => {
    expect(
      resolveFailureHandling({
        category: 'STORAGE_FAILURE',
        retryCount: 0,
      }),
    ).toMatchObject({
      shouldRetry: false,
      nextAction: 'FAIL_CASE',
      blockWorkflowAdvance: true,
    });

    expect(
      resolveFailureHandling({
        category: 'JUDGE_DEAD_END',
        retryCount: 0,
      }),
    ).toMatchObject({
      shouldRetry: false,
      nextAction: 'MANUAL_REVIEW_OR_REJECT',
      blockWorkflowAdvance: true,
    });
  });

  it('logs retry resolution decisions as structured JSON entries', () => {
    const entries: StructuredLogEntry[] = [];
    const logger = createStructuredLogger({
      now: () => new Date('2026-03-12T00:00:00.000Z'),
      write(_line, entry) {
        entries.push(entry);
      },
    });

    const resolution = resolveFailureHandling(
      {
        category: 'AGENT_TIMEOUT',
        retryCount: 0,
        caseId: 'case-1',
        iterationId: 'iter-1',
        agentName: 'Judge',
        jobId: 'job-1',
      },
      logger,
    );

    expect(resolution.nextAction).toBe('RETRY');
    expect(entries).toEqual([
      {
        timestamp: '2026-03-12T00:00:00.000Z',
        level: 'info',
        event: 'workflow.retry.resolved',
        message: 'Resolved workflow retry handling for a failure category.',
        context: {
          caseId: 'case-1',
          iterationId: 'iter-1',
          agentName: 'Judge',
          jobId: 'job-1',
          category: 'AGENT_TIMEOUT',
          retryCount: 0,
          shouldRetry: true,
          nextAction: 'RETRY',
        },
      },
    ]);
  });
});
