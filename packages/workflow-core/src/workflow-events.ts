import {
  type OpportunityCase,
  type StructuredLogger,
  createNoopStructuredLogger,
} from '@venture-advisor-os/shared-types';

export interface NextPendingCaseSelector {
  getNextPendingCase(): Promise<OpportunityCase | null>;
}

export interface RejectionEscalationEvent {
  type: 'REJECTION_ESCALATION';
  emittedAt: string;
  rejectedCaseId: string;
  rejectionCategory?: string;
  rejectionRationale?: string;
  nextTopicCaseId?: string;
  nextTopicStatus?: OpportunityCase['status'];
}

export interface NextTopicContinuationEvent {
  type: 'NEXT_TOPIC_CONTINUATION';
  emittedAt: string;
  requestedAfterCaseId: string;
  nextCaseId?: string;
  nextCaseStatus?: OpportunityCase['status'];
  priorityBand: 'fresh-actionable' | 'manual-review-failed' | 'none';
}

export interface WorkflowEventService {
  buildRejectionEscalationEvent(input: {
    rejectedCase: Pick<
      OpportunityCase,
      'caseId' | 'rejectionCategory' | 'rejectionRationale'
    >;
    emittedAt: string;
  }): Promise<RejectionEscalationEvent>;
  buildNextTopicContinuationEvent(input: {
    requestedAfterCaseId: string;
    emittedAt: string;
  }): Promise<NextTopicContinuationEvent>;
}

export function createWorkflowEventService(
  selector: NextPendingCaseSelector,
  logger: StructuredLogger = createNoopStructuredLogger(),
): WorkflowEventService {
  return {
    async buildRejectionEscalationEvent(input) {
      const nextCase = await selector.getNextPendingCase();
      const event = {
        type: 'REJECTION_ESCALATION',
        emittedAt: input.emittedAt,
        rejectedCaseId: input.rejectedCase.caseId,
        rejectionCategory: input.rejectedCase.rejectionCategory,
        rejectionRationale: input.rejectedCase.rejectionRationale,
        nextTopicCaseId: nextCase?.caseId,
        nextTopicStatus: nextCase?.status,
      } satisfies RejectionEscalationEvent;

      logger.info(
        'workflow.routing.rejection_escalation',
        'Built a rejection escalation workflow event.',
        {
          caseId: input.rejectedCase.caseId,
          nextTopicCaseId: nextCase?.caseId,
        },
      );

      return event;
    },
    async buildNextTopicContinuationEvent(input) {
      const nextCase = await selector.getNextPendingCase();
      const event = {
        type: 'NEXT_TOPIC_CONTINUATION',
        emittedAt: input.emittedAt,
        requestedAfterCaseId: input.requestedAfterCaseId,
        nextCaseId: nextCase?.caseId,
        nextCaseStatus: nextCase?.status,
        priorityBand: resolvePriorityBand(nextCase),
      } satisfies NextTopicContinuationEvent;

      logger.info(
        'workflow.routing.next_topic_continuation',
        'Built a next-topic continuation workflow event.',
        {
          caseId: input.requestedAfterCaseId,
          nextCaseId: nextCase?.caseId,
          priorityBand: event.priorityBand,
        },
      );

      return event;
    },
  };
}

function resolvePriorityBand(
  nextCase: OpportunityCase | null,
): NextTopicContinuationEvent['priorityBand'] {
  if (nextCase === null) {
    return 'none';
  }

  if (
    nextCase.status === 'TOPIC_ACCEPTED' ||
    nextCase.status === 'REVISE_REQUIRED' ||
    nextCase.status === 'PIVOT_REQUIRED'
  ) {
    return 'fresh-actionable';
  }

  return 'manual-review-failed';
}
