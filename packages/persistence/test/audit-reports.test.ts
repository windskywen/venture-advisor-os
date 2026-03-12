import { describe, expect, it } from 'vitest';

import { createAuditReportService } from '../src/index.js';

describe('audit report service', () => {
  it('builds an audit view with scores, rerun plans, thresholds, termination triggers, and overrides', async () => {
    const service = createAuditReportService({
      repositories: {
        cases: {
          async getById(caseId) {
            return {
              caseId,
              topic: 'AI bookkeeping',
              preferredBusinessModels: ['SaaS'],
              constraints: [],
              status: 'REJECTED',
              currentIteration: 2,
              maxIterations: 3,
              finalDecision: 'REJECT',
              rejectionCategory: 'INSUFFICIENT_EVIDENCE_AFTER_ITERATION_BUDGET',
              rejectionRationale: 'No material progress remained.',
              manualReviewRequired: false,
              portfolioEscalationMetadata: {},
              createdAt: '2026-03-12T10:00:00.000Z',
              updatedAt: '2026-03-12T10:45:00.000Z',
            };
          },
        },
        iterations: {
          async listByCaseId(caseId) {
            return [
              {
                iterationId: 'iter-1',
                caseId,
                iterationNo: 1,
                statusAtStart: 'RESEARCHING',
                statusAtEnd: 'JUDGE_REVIEW',
                judgeDecision: 'REVISE',
                agentOutputIds: [],
                judgeTaskIds: [],
                scoreDetailIds: [],
                startedAt: '2026-03-12T10:05:00.000Z',
                completedAt: '2026-03-12T10:20:00.000Z',
              },
              {
                iterationId: 'iter-2',
                caseId,
                iterationNo: 2,
                statusAtStart: 'RESEARCHING',
                statusAtEnd: 'REJECTED',
                judgeDecision: 'REJECT',
                agentOutputIds: [],
                judgeTaskIds: [],
                scoreDetailIds: [],
                startedAt: '2026-03-12T10:25:00.000Z',
                completedAt: '2026-03-12T10:40:00.000Z',
              },
            ];
          },
        },
        agentOutputs: {
          async listByIterationId(iterationId) {
            if (iterationId === 'iter-1') {
              return [
                {
                  agentOutputId: 'judge-1',
                  caseId: 'case-1',
                  iterationId,
                  iterationNo: 1,
                  agentName: 'Judge',
                  rawOutput: '{}',
                  normalizedOutput: {
                    decision: 'REVISE',
                    termination_warning: false,
                  },
                  validationErrors: [],
                  createdAt: '2026-03-12T10:20:00.000Z',
                },
              ];
            }

            return [
              {
                agentOutputId: 'judge-2',
                caseId: 'case-1',
                iterationId,
                iterationNo: 2,
                agentName: 'Judge',
                rawOutput: '{}',
                normalizedOutput: {
                  decision: 'REJECT',
                  termination_warning: true,
                },
                validationErrors: [],
                createdAt: '2026-03-12T10:40:00.000Z',
              },
            ];
          },
        },
        judgeTasks: {
          async listByIterationId(iterationId) {
            if (iterationId === 'iter-1') {
              return [
                {
                  taskId: 'task-a',
                  caseId: 'case-1',
                  iterationId,
                  iterationNo: 1,
                  taskType: 'EVIDENCE_REFRESH',
                  targetAgent: 'FACT_RESEARCHER',
                  description: 'Refresh evidence.',
                  blocking: true,
                },
                {
                  taskId: 'task-b',
                  caseId: 'case-1',
                  iterationId,
                  iterationNo: 1,
                  taskType: 'MVP_RESCOPING',
                  targetAgent: 'OPPORTUNITY_STRATEGIST',
                  description: 'Rescope the MVP.',
                  blocking: true,
                },
              ];
            }

            return [
              {
                taskId: 'task-c',
                caseId: 'case-1',
                iterationId,
                iterationNo: 2,
                taskType: 'TERMINAL_RISK_CONFIRMATION',
                targetAgent: 'FACT_RESEARCHER',
                description: 'Confirm terminal risk.',
                blocking: true,
              },
            ];
          },
        },
        scoreDetails: {
          async listByIterationId(iterationId) {
            if (iterationId === 'iter-1') {
              return [
                {
                  scoreDetailId: 'score-1',
                  caseId: 'case-1',
                  iterationId,
                  iterationNo: 1,
                  scoringAgent: 'VCCritic',
                  dimension: 'vcAverage',
                  score: 7.6,
                  rationale: 'Solid baseline.',
                },
                {
                  scoreDetailId: 'score-2',
                  caseId: 'case-1',
                  iterationId,
                  iterationNo: 1,
                  scoringAgent: 'Judge',
                  dimension: 'evidenceCompleteness',
                  score: 6.8,
                  rationale: 'Evidence needs refresh.',
                },
              ];
            }

            return [];
          },
        },
        auditLogs: {
          async listByCaseId() {
            return [
              {
                auditLogId: 'audit-1',
                caseId: 'case-1',
                iterationId: 'iter-2',
                iterationNo: 2,
                action: 'MANUAL_OVERRIDE_FORCE_REJECT',
                actor: 'operator',
                metadata: {
                  reason: 'Stop the case.',
                },
                createdAt: '2026-03-12T10:42:00.000Z',
              },
            ];
          },
        },
        approvals: {
          async listByCaseId() {
            return [
              {
                approvalId: 'approval-1',
                caseId: 'case-1',
                iterationId: 'iter-2',
                requestedAction: 'FORCE_REJECT',
                status: 'RESOLVED',
                requestedAt: '2026-03-12T10:41:00.000Z',
                resolvedAt: '2026-03-12T10:42:00.000Z',
                resolvedBy: 'operator',
                metadata: {
                  riskLevel: 'high',
                },
              },
            ];
          },
        },
      },
      workflowConfig: {
        thresholds: {
          vcPass: 7.5,
          evidencePass: 7,
          minimumScoreImprovement: 0.4,
        },
        judgeThresholds: {
          vcPass: 7.5,
          evidencePass: 7,
        },
        iterationBudget: {
          standardTopicMaxIterations: 3,
          complexTopicMaxIterations: 5,
          maxStagnantIterations: 2,
        },
        timeoutBudgets: {
          agentRunMs: 300000,
          reportRenderMs: 60000,
          prdGenerationMs: 120000,
          pocGenerationMs: 120000,
        },
        routingPolicy: {
          preferTerminalDecisionByIteration: 3,
          rejectOnConsecutiveStagnation: true,
          rejectOnTerminationWarningWithoutMaterialImprovement: true,
          rejectOnUnresolvedFatalFlaws: true,
          allowReviseOnFatalFlawWithConcreteDisproofPath: true,
          requireJudgePassForPassRouting: true,
          requirePassForDownstreamGeneration: true,
        },
        research: {
          defaultStyle: 'BALANCED',
        },
        browsingAutonomy: {
          defaultProfile: 'STANDARD',
          allowAdjacentExploration: false,
          allowCompetitorExploration: true,
          allowOpenEndedQueries: false,
          maxSourcesPerQuery: 5,
          recencyWindowDays: 120,
        },
      },
    });

    const report = await service.getCaseAuditReport('case-1');

    expect(report.thresholdsUsed.thresholds.vcPass).toBe(7.5);
    expect(report.thresholdsUsed.judgeThresholds.vcPass).toBe(7.5);
    expect(report.decisionSummary).toEqual({
      latestJudgeDecision: 'REJECT',
      finalDecision: 'REJECT',
      failureCategory: undefined,
      rejectionCategory: 'INSUFFICIENT_EVIDENCE_AFTER_ITERATION_BUDGET',
      manualReviewRequired: false,
    });
    expect(report.iterations[0]).toMatchObject({
      iterationId: 'iter-1',
      judgeDecision: 'REVISE',
      rerunPlan: {
        strategy: 'A_THEN_B',
        blockingTaskCount: 2,
        prohibitedReasons: [],
      },
      routingSummary: {
        caseId: 'case-1',
        iterationId: 'iter-1',
        iterationNo: 1,
        vcAverage: 7.6,
        evidenceCompleteness: 6.8,
      },
    });
    expect(report.iterations[1]).toMatchObject({
      iterationId: 'iter-2',
      judgeDecision: 'REJECT',
      rerunPlan: {
        strategy: 'PROHIBITED',
      },
      terminationTriggers: [
        'termination_warning',
        'rejection:INSUFFICIENT_EVIDENCE_AFTER_ITERATION_BUDGET',
      ],
      rejectionCategory: 'INSUFFICIENT_EVIDENCE_AFTER_ITERATION_BUDGET',
    });
    expect(report.overrides.approvals).toHaveLength(1);
    expect(report.overrides.auditLogs).toEqual([
      expect.objectContaining({
        action: 'MANUAL_OVERRIDE_FORCE_REJECT',
      }),
    ]);
  });
});
