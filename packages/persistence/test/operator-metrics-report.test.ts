import { describe, expect, it } from 'vitest';

import { createOperatorMetricsReportService } from '../src/index.js';

describe('operator metrics report service', () => {
  it('combines product metrics with founder-value summaries', async () => {
    const service = createOperatorMetricsReportService({
      repositories: {
        cases: {
          async listAll() {
            return [
              {
                caseId: 'case-1',
                topic: 'AI bookkeeping',
                preferredBusinessModels: ['SaaS'],
                constraints: [],
                status: 'COMPLETED',
                currentIteration: 2,
                maxIterations: 3,
                finalDecision: 'PASS',
                manualReviewRequired: false,
                createdAt: '2026-03-12T10:00:00.000Z',
                updatedAt: '2026-03-12T10:30:00.000Z',
              },
            ];
          },
        },
        iterations: {
          async listAll() {
            return [
              {
                iterationId: 'iter-1',
                caseId: 'case-1',
                iterationNo: 1,
                statusAtStart: 'RESEARCHING',
                statusAtEnd: 'JUDGE_REVIEW',
                judgeDecision: 'REVISE',
                agentOutputIds: [],
                judgeTaskIds: [],
                scoreDetailIds: [],
                startedAt: '2026-03-12T10:01:00.000Z',
                completedAt: '2026-03-12T10:10:00.000Z',
              },
              {
                iterationId: 'iter-2',
                caseId: 'case-1',
                iterationNo: 2,
                statusAtStart: 'RESEARCHING',
                statusAtEnd: 'COMPLETED',
                judgeDecision: 'PASS',
                agentOutputIds: [],
                judgeTaskIds: [],
                scoreDetailIds: [],
                startedAt: '2026-03-12T10:11:00.000Z',
                completedAt: '2026-03-12T10:20:00.000Z',
              },
            ];
          },
        },
        agentOutputs: {
          async listAll() {
            return [
              {
                agentOutputId: 'judge-1',
                caseId: 'case-1',
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
            ];
          },
        },
        auditLogs: {
          async listAll() {
            return [];
          },
        },
        founderValueMeasurements: {
          async listAll() {
            return [
              {
                measurementId: 'measurement-1',
                caseId: 'case-1',
                respondentType: 'OPERATOR',
                actor: 'operator',
                perceivedUsefulnessScore: 4,
                confidenceIncreaseScore: 5,
                manualResearchMinutesSaved: 90,
                createdAt: '2026-03-12T10:40:00.000Z',
              },
              {
                measurementId: 'measurement-2',
                caseId: 'case-1',
                respondentType: 'FOUNDER',
                actor: 'founder',
                perceivedUsefulnessScore: 5,
                confidenceIncreaseScore: 4,
                manualResearchMinutesSaved: 60,
                createdAt: '2026-03-12T10:45:00.000Z',
              },
            ];
          },
        },
      },
      artifactIndex: {
        async listCaseArtifacts() {
          return [
            {
              name: 'prd.md',
              path: '/storage/cases/case-1/prd.md',
              kind: 'prd',
            },
            {
              name: 'poc_spec.md',
              path: '/storage/cases/case-1/poc_spec.md',
              kind: 'poc',
            },
          ];
        },
      },
      now: () => new Date('2026-03-12T11:00:00.000Z'),
    });

    const report = await service.collect();

    expect(report.generatedAt).toBe('2026-03-12T11:00:00.000Z');
    expect(report.productMetrics).toMatchObject({
      topicsReachingJudgeCompletion: 1,
      passToPrdCompletionRate: 1,
      passToPocCompletionRate: 1,
    });
    expect(report.founderValue).toEqual({
      measurementCount: 2,
      averagePerceivedUsefulnessScore: 4.5,
      averageConfidenceIncreaseScore: 4.5,
      averageManualResearchMinutesSaved: 75,
      latestMeasurementAt: '2026-03-12T10:45:00.000Z',
      byRespondentType: {
        OPERATOR: 1,
        FOUNDER: 1,
      },
    });
  });
});
