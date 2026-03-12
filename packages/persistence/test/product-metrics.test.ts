import { describe, expect, it } from 'vitest';

import { createProductMetricsService } from '../src/index.js';

describe('product metrics service', () => {
  it('computes the PRD success metrics set from persisted workflow data', async () => {
    const service = createProductMetricsService({
      repositories: {
        cases: {
          async listAll() {
            return [
              {
                caseId: 'case-pass-complete',
                topic: 'AI bookkeeping',
                preferredBusinessModels: [],
                constraints: [],
                status: 'COMPLETED',
                currentIteration: 2,
                maxIterations: 3,
                approvedSourceIterationId: 'iter-2',
                approvedSourceIterationNo: 2,
                finalDecision: 'PASS',
                manualReviewRequired: false,
                portfolioEscalationMetadata: {},
                createdAt: '2026-03-12T10:00:00.000Z',
                updatedAt: '2026-03-12T10:45:00.000Z',
              },
              {
                caseId: 'case-reject-market',
                topic: 'Weak market',
                preferredBusinessModels: [],
                constraints: [],
                status: 'REJECTED',
                currentIteration: 1,
                maxIterations: 3,
                finalDecision: 'REJECT',
                rejectionCategory: 'WEAK_MARKET',
                rejectionRationale: 'TAM is too small.',
                manualReviewRequired: false,
                portfolioEscalationMetadata: {},
                createdAt: '2026-03-12T10:00:00.000Z',
                updatedAt: '2026-03-12T10:15:00.000Z',
              },
              {
                caseId: 'case-reject-stagnation',
                topic: 'Stagnant case',
                preferredBusinessModels: [],
                constraints: [],
                status: 'REJECTED',
                currentIteration: 3,
                maxIterations: 3,
                finalDecision: 'REJECT',
                rejectionCategory: 'INSUFFICIENT_EVIDENCE_AFTER_ITERATION_BUDGET',
                rejectionRationale: 'No material progress after repeated loops.',
                manualReviewRequired: false,
                portfolioEscalationMetadata: {},
                createdAt: '2026-03-12T10:00:00.000Z',
                updatedAt: '2026-03-12T10:40:00.000Z',
              },
              {
                caseId: 'case-dead-end',
                topic: 'Dead end',
                preferredBusinessModels: [],
                constraints: [],
                status: 'FAILED',
                currentIteration: 2,
                maxIterations: 3,
                failureCategory: 'JUDGE_DEAD_END',
                manualReviewRequired: true,
                portfolioEscalationMetadata: {},
                createdAt: '2026-03-12T10:00:00.000Z',
                updatedAt: '2026-03-12T10:30:00.000Z',
              },
              {
                caseId: 'case-pass-prd',
                topic: 'PRD ready',
                preferredBusinessModels: [],
                constraints: [],
                status: 'APPROVED_FOR_PRD',
                currentIteration: 2,
                maxIterations: 3,
                approvedSourceIterationId: 'iter-2',
                approvedSourceIterationNo: 2,
                finalDecision: 'PASS',
                manualReviewRequired: false,
                portfolioEscalationMetadata: {},
                createdAt: '2026-03-12T10:00:00.000Z',
                updatedAt: '2026-03-12T10:25:00.000Z',
              },
            ];
          },
        },
        iterations: {
          async listAll() {
            return [
              {
                iterationId: 'iter-2',
                caseId: 'case-pass-complete',
                iterationNo: 2,
                startedAt: '2026-03-12T10:05:00.000Z',
              },
              {
                iterationId: 'iter-1',
                caseId: 'case-reject-market',
                iterationNo: 1,
                startedAt: '2026-03-12T10:05:00.000Z',
              },
              {
                iterationId: 'iter-3',
                caseId: 'case-reject-stagnation',
                iterationNo: 3,
                startedAt: '2026-03-12T10:05:00.000Z',
              },
              {
                iterationId: 'iter-2b',
                caseId: 'case-dead-end',
                iterationNo: 2,
                startedAt: '2026-03-12T10:05:00.000Z',
              },
              {
                iterationId: 'iter-2c',
                caseId: 'case-pass-prd',
                iterationNo: 2,
                startedAt: '2026-03-12T10:05:00.000Z',
              },
            ];
          },
        },
        agentOutputs: {
          async listAll() {
            return [
              {
                agentOutputId: 'judge-1',
                caseId: 'case-pass-complete',
                iterationId: 'iter-2',
                iterationNo: 2,
                agentName: 'Judge',
                rawOutput: '{}',
                normalizedOutput: {
                  decision: 'PASS',
                },
                validationErrors: [],
                createdAt: '2026-03-12T10:20:00.000Z',
              },
              {
                agentOutputId: 'judge-2',
                caseId: 'case-reject-market',
                iterationId: 'iter-1',
                iterationNo: 1,
                agentName: 'Judge',
                rawOutput: '{}',
                normalizedOutput: {
                  decision: 'REJECT',
                },
                validationErrors: ['Missing citation'],
                createdAt: '2026-03-12T10:10:00.000Z',
              },
              {
                agentOutputId: 'judge-3',
                caseId: 'case-reject-stagnation',
                iterationId: 'iter-3',
                iterationNo: 3,
                agentName: 'Judge',
                rawOutput: '{}',
                normalizedOutput: {
                  decision: 'PIVOT',
                },
                validationErrors: [],
                createdAt: '2026-03-12T10:35:00.000Z',
              },
              {
                agentOutputId: 'judge-4',
                caseId: 'case-dead-end',
                iterationId: 'iter-2b',
                iterationNo: 2,
                agentName: 'Judge',
                rawOutput: '{}',
                normalizedOutput: {
                  decision: 'REVISE',
                },
                validationErrors: [],
                createdAt: '2026-03-12T10:25:00.000Z',
              },
              {
                agentOutputId: 'judge-5',
                caseId: 'case-pass-prd',
                iterationId: 'iter-2c',
                iterationNo: 2,
                agentName: 'Judge',
                rawOutput: '{}',
                normalizedOutput: {
                  decision: 'PASS',
                },
                validationErrors: [],
                createdAt: '2026-03-12T10:30:00.000Z',
              },
            ];
          },
        },
        auditLogs: {
          async listAll() {
            return [
              {
                auditLogId: 'audit-1',
                caseId: 'case-reject-market',
                action: 'MANUAL_OVERRIDE_FORCE_REJECT',
                actor: 'operator',
                metadata: {},
                createdAt: '2026-03-12T10:12:00.000Z',
              },
              {
                auditLogId: 'audit-2',
                caseId: 'case-pass-prd',
                action: 'MANUAL_OVERRIDE_FORCE_PASS_TO_PRD',
                actor: 'operator',
                metadata: {},
                createdAt: '2026-03-12T10:32:00.000Z',
              },
            ];
          },
        },
      },
      artifactIndex: {
        async listCaseArtifacts(caseId) {
          if (caseId === 'case-pass-complete') {
            return [
              {
                name: 'prd.md',
                path: 'storage/cases/case-pass-complete/prd.md',
                kind: 'prd',
              },
              {
                name: 'poc_spec.md',
                path: 'storage/cases/case-pass-complete/poc_spec.md',
                kind: 'poc',
              },
            ];
          }

          if (caseId === 'case-pass-prd') {
            return [
              {
                name: 'prd.md',
                path: 'storage/cases/case-pass-prd/prd.md',
                kind: 'prd',
              },
            ];
          }

          return [];
        },
      },
      now: () => new Date('2026-03-12T11:00:00.000Z'),
    });

    const snapshot = await service.collect();
    const prometheusMetrics = await service.collectPrometheusMetrics();

    expect(snapshot).toEqual({
      generatedAt: '2026-03-12T11:00:00.000Z',
      topicsReachingJudgeCompletion: 5,
      prePrdRejectionRate: 0.4,
      averageIterationsPerCase: 2,
      passToPrdCompletionRate: 1,
      passToPocCompletionRate: 0.5,
      averageTimeToDecisionMs: 1440000,
      schemaValidationSuccessRate: 0.8,
      manualOverrideCount: 2,
      stagnationDetectedCount: 2,
      stagnationRejectedCount: 1,
      targetedRerunRate: 0.4,
    });
    expect(prometheusMetrics).toEqual({
      venture_advisor_topics_reaching_judge_completion_total: 5,
      venture_advisor_pre_prd_rejection_rate: 0.4,
      venture_advisor_average_iterations_per_case: 2,
      venture_advisor_pass_to_prd_completion_rate: 1,
      venture_advisor_pass_to_poc_completion_rate: 0.5,
      venture_advisor_average_time_to_decision_ms: 1440000,
      venture_advisor_schema_validation_success_rate: 0.8,
      venture_advisor_manual_override_count: 2,
      venture_advisor_stagnation_detected_count: 2,
      venture_advisor_stagnation_rejected_count: 1,
      venture_advisor_targeted_rerun_rate: 0.4,
    });
  });
});
