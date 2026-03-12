import type { AgentName } from '@venture-advisor-os/shared-types';

export type PartialRerunReason =
  | 'FORMATTING_ONLY_UPSTREAM_CHANGE'
  | 'SYSTEM_ERROR_RECOVERY';

export interface PartialRerunRequest {
  targetAgent: Extract<AgentName, 'VCCritic' | 'Judge'>;
  reason: PartialRerunReason;
}

export interface PartialRerunPlan {
  strategy: 'C_ONLY' | 'J_ONLY' | 'PROHIBITED';
  targetAgent?: Extract<AgentName, 'VCCritic' | 'Judge'>;
  reason: PartialRerunReason;
  prohibitedReason?: string;
}

export function planPartialRerun(
  request: PartialRerunRequest,
): PartialRerunPlan {
  if (
    request.targetAgent === 'VCCritic' &&
    request.reason === 'FORMATTING_ONLY_UPSTREAM_CHANGE'
  ) {
    return {
      strategy: 'C_ONLY',
      targetAgent: 'VCCritic',
      reason: request.reason,
    };
  }

  if (
    request.targetAgent === 'Judge' &&
    request.reason === 'SYSTEM_ERROR_RECOVERY'
  ) {
    return {
      strategy: 'J_ONLY',
      targetAgent: 'Judge',
      reason: request.reason,
    };
  }

  return {
    strategy: 'PROHIBITED',
    reason: request.reason,
    prohibitedReason:
      request.targetAgent === 'Judge'
        ? 'Judge-only reruns are only allowed for system error recovery.'
        : 'VCCritic-only reruns are only allowed for formatting-only upstream changes.',
  };
}
