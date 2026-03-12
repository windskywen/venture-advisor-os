import {
  type FailureCategory,
  type StructuredLogger,
  createNoopStructuredLogger,
} from '@venture-advisor-os/shared-types';

export interface FailureRetryPolicy {
  category: FailureCategory;
  maxRetryCount: number;
  useStricterFormattingReminderOnRetry: boolean;
  manualReviewRequiredAfterExhaustion: boolean;
  blockWorkflowAdvance: boolean;
  exhaustedAction: 'FAIL_CASE' | 'MANUAL_REVIEW' | 'MANUAL_REVIEW_OR_REJECT';
}

export interface FailureHandlingInput {
  category: FailureCategory;
  retryCount: number;
  requestId?: string;
  caseId?: string;
  iterationId?: string;
  agentName?: string;
  jobId?: string;
}

export interface FailureHandlingResolution extends FailureRetryPolicy {
  shouldRetry: boolean;
  nextAction: 'RETRY' | FailureRetryPolicy['exhaustedAction'];
}

const FAILURE_RETRY_POLICIES: Record<FailureCategory, FailureRetryPolicy> = {
  INFRA_FAILURE: {
    category: 'INFRA_FAILURE',
    maxRetryCount: 3,
    useStricterFormattingReminderOnRetry: false,
    manualReviewRequiredAfterExhaustion: true,
    blockWorkflowAdvance: true,
    exhaustedAction: 'FAIL_CASE',
  },
  AGENT_TIMEOUT: {
    category: 'AGENT_TIMEOUT',
    maxRetryCount: 1,
    useStricterFormattingReminderOnRetry: false,
    manualReviewRequiredAfterExhaustion: true,
    blockWorkflowAdvance: true,
    exhaustedAction: 'FAIL_CASE',
  },
  MALFORMED_OUTPUT: {
    category: 'MALFORMED_OUTPUT',
    maxRetryCount: 1,
    useStricterFormattingReminderOnRetry: true,
    manualReviewRequiredAfterExhaustion: true,
    blockWorkflowAdvance: true,
    exhaustedAction: 'FAIL_CASE',
  },
  NORMALIZATION_FAILURE: {
    category: 'NORMALIZATION_FAILURE',
    maxRetryCount: 0,
    useStricterFormattingReminderOnRetry: false,
    manualReviewRequiredAfterExhaustion: true,
    blockWorkflowAdvance: true,
    exhaustedAction: 'MANUAL_REVIEW',
  },
  SCHEMA_VALIDATION_FAILURE: {
    category: 'SCHEMA_VALIDATION_FAILURE',
    maxRetryCount: 0,
    useStricterFormattingReminderOnRetry: false,
    manualReviewRequiredAfterExhaustion: true,
    blockWorkflowAdvance: true,
    exhaustedAction: 'MANUAL_REVIEW',
  },
  INVALID_AGENT_OUTPUT: {
    category: 'INVALID_AGENT_OUTPUT',
    maxRetryCount: 0,
    useStricterFormattingReminderOnRetry: false,
    manualReviewRequiredAfterExhaustion: true,
    blockWorkflowAdvance: true,
    exhaustedAction: 'MANUAL_REVIEW',
  },
  JUDGE_DEAD_END: {
    category: 'JUDGE_DEAD_END',
    maxRetryCount: 0,
    useStricterFormattingReminderOnRetry: false,
    manualReviewRequiredAfterExhaustion: true,
    blockWorkflowAdvance: true,
    exhaustedAction: 'MANUAL_REVIEW_OR_REJECT',
  },
  STORAGE_FAILURE: {
    category: 'STORAGE_FAILURE',
    maxRetryCount: 0,
    useStricterFormattingReminderOnRetry: false,
    manualReviewRequiredAfterExhaustion: true,
    blockWorkflowAdvance: true,
    exhaustedAction: 'FAIL_CASE',
  },
};

export function getFailureRetryPolicy(
  category: FailureCategory,
): FailureRetryPolicy {
  return FAILURE_RETRY_POLICIES[category];
}

export function resolveFailureHandling(
  input: FailureHandlingInput,
  logger: StructuredLogger = createNoopStructuredLogger(),
): FailureHandlingResolution {
  const policy = getFailureRetryPolicy(input.category);
  const shouldRetry = input.retryCount < policy.maxRetryCount;
  const resolution = {
    ...policy,
    shouldRetry,
    nextAction: shouldRetry ? 'RETRY' : policy.exhaustedAction,
  } satisfies FailureHandlingResolution;

  logger.info(
    'workflow.retry.resolved',
    'Resolved workflow retry handling for a failure category.',
    {
      requestId: input.requestId,
      caseId: input.caseId,
      iterationId: input.iterationId,
      agentName: input.agentName,
      jobId: input.jobId,
      category: input.category,
      retryCount: input.retryCount,
      shouldRetry,
      nextAction: resolution.nextAction,
    },
  );

  return resolution;
}
