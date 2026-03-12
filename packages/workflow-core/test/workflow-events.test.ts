import { describe, expect, it } from 'vitest';

import {
  createStructuredLogger,
  type StructuredLogEntry,
} from '@venture-advisor-os/shared-types';

import { createWorkflowEventService } from '../src/index.js';

describe('workflow events', () => {
  it('emits rejection escalation events with the next persisted case selection', async () => {
    const eventService = createWorkflowEventService({
      async getNextPendingCase() {
        return {
          caseId: 'case-2',
          topic: 'Fresh topic',
          preferredBusinessModels: [],
          constraints: [],
          status: 'TOPIC_ACCEPTED',
          currentIteration: 0,
          maxIterations: 3,
          portfolioEscalationMetadata: {},
          manualReviewRequired: false,
          createdAt: '2026-03-12T00:00:00.000Z',
          updatedAt: '2026-03-12T00:00:00.000Z',
        };
      },
    });

    const event = await eventService.buildRejectionEscalationEvent({
      rejectedCase: {
        caseId: 'case-1',
        rejectionCategory: 'WEAK_MARKET',
        rejectionRationale: 'The TAM is too small.',
      },
      emittedAt: '2026-03-12T01:00:00.000Z',
    });

    expect(event).toEqual({
      type: 'REJECTION_ESCALATION',
      emittedAt: '2026-03-12T01:00:00.000Z',
      rejectedCaseId: 'case-1',
      rejectionCategory: 'WEAK_MARKET',
      rejectionRationale: 'The TAM is too small.',
      nextTopicCaseId: 'case-2',
      nextTopicStatus: 'TOPIC_ACCEPTED',
    });
  });

  it('emits next-topic continuation events with the correct priority band', async () => {
    const eventService = createWorkflowEventService({
      async getNextPendingCase() {
        return {
          caseId: 'case-3',
          topic: 'Needs review',
          preferredBusinessModels: [],
          constraints: [],
          status: 'FAILED',
          currentIteration: 2,
          maxIterations: 3,
          portfolioEscalationMetadata: {},
          manualReviewRequired: true,
          createdAt: '2026-03-12T00:00:00.000Z',
          updatedAt: '2026-03-12T00:00:00.000Z',
        };
      },
    });

    const event = await eventService.buildNextTopicContinuationEvent({
      requestedAfterCaseId: 'case-1',
      emittedAt: '2026-03-12T01:00:00.000Z',
    });

    expect(event).toEqual({
      type: 'NEXT_TOPIC_CONTINUATION',
      emittedAt: '2026-03-12T01:00:00.000Z',
      requestedAfterCaseId: 'case-1',
      nextCaseId: 'case-3',
      nextCaseStatus: 'FAILED',
      priorityBand: 'manual-review-failed',
    });
  });

  it('returns an empty priority band when no pending case exists', async () => {
    const eventService = createWorkflowEventService({
      async getNextPendingCase() {
        return null;
      },
    });

    const event = await eventService.buildNextTopicContinuationEvent({
      requestedAfterCaseId: 'case-1',
      emittedAt: '2026-03-12T01:00:00.000Z',
    });

    expect(event.priorityBand).toBe('none');
    expect(event.nextCaseId).toBeUndefined();
  });

  it('logs routing decisions for next-topic continuation events', async () => {
    const entries: StructuredLogEntry[] = [];
    const logger = createStructuredLogger({
      now: () => new Date('2026-03-12T00:00:00.000Z'),
      write(_line, entry) {
        entries.push(entry);
      },
    });
    const eventService = createWorkflowEventService(
      {
        async getNextPendingCase() {
          return {
            caseId: 'case-9',
            topic: 'Fresh topic',
            preferredBusinessModels: [],
            constraints: [],
            status: 'TOPIC_ACCEPTED',
            currentIteration: 0,
            maxIterations: 3,
            portfolioEscalationMetadata: {},
            manualReviewRequired: false,
            createdAt: '2026-03-12T00:00:00.000Z',
            updatedAt: '2026-03-12T00:00:00.000Z',
          };
        },
      },
      logger,
    );

    await eventService.buildNextTopicContinuationEvent({
      requestedAfterCaseId: 'case-1',
      emittedAt: '2026-03-12T01:00:00.000Z',
    });

    expect(entries).toEqual([
      {
        timestamp: '2026-03-12T00:00:00.000Z',
        level: 'info',
        event: 'workflow.routing.next_topic_continuation',
        message: 'Built a next-topic continuation workflow event.',
        context: {
          caseId: 'case-1',
          nextCaseId: 'case-9',
          priorityBand: 'fresh-actionable',
        },
      },
    ]);
  });
});
