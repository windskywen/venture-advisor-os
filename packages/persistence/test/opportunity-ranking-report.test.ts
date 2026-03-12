import { describe, expect, it } from 'vitest';

import { createOpportunityRankingReportService } from '../src/index.js';

describe('opportunity ranking report service', () => {
  it('ranks cases across the portfolio and returns richer analytics', async () => {
    const service = createOpportunityRankingReportService({
      repositories: {
        cases: {
          async listAll() {
            return [
              {
                caseId: 'case-pass',
                topic: 'AI bookkeeping',
                preferredBusinessModels: ['SaaS'],
                constraints: [],
                status: 'COMPLETED',
                currentIteration: 2,
                maxIterations: 3,
                finalDecision: 'PASS',
                manualReviewRequired: false,
                createdAt: '2026-03-12T09:00:00.000Z',
                updatedAt: '2026-03-12T10:30:00.000Z',
              },
              {
                caseId: 'case-revise',
                topic: 'Compliance assistant',
                preferredBusinessModels: ['SaaS'],
                constraints: [],
                status: 'REVISE_REQUIRED',
                currentIteration: 1,
                maxIterations: 3,
                manualReviewRequired: false,
                createdAt: '2026-03-12T09:30:00.000Z',
                updatedAt: '2026-03-12T10:00:00.000Z',
              },
              {
                caseId: 'case-pending',
                topic: 'Exploratory topic',
                preferredBusinessModels: [],
                constraints: [],
                status: 'TOPIC_ACCEPTED',
                currentIteration: 0,
                maxIterations: 3,
                manualReviewRequired: false,
                createdAt: '2026-03-12T10:00:00.000Z',
                updatedAt: '2026-03-12T10:05:00.000Z',
              },
            ];
          },
        },
        agentOutputs: {
          async listAll() {
            return [
              {
                agentOutputId: 'vc-pass',
                caseId: 'case-pass',
                iterationId: 'iter-pass-2',
                iterationNo: 2,
                agentName: 'VCCritic',
                rawOutput: '{}',
                normalizedOutput: {
                  score_breakdown: [
                    {
                      dimension: 'Market Size',
                      score: 8,
                    },
                  ],
                },
                validationErrors: [],
                createdAt: '2026-03-12T10:15:00.000Z',
              },
              {
                agentOutputId: 'judge-pass',
                caseId: 'case-pass',
                iterationId: 'iter-pass-2',
                iterationNo: 2,
                agentName: 'Judge',
                rawOutput: '{}',
                normalizedOutput: {
                  decision: 'PASS',
                  evidence_assessment: {
                    completeness: 8,
                    freshness: 8,
                    confidence: 8,
                  },
                },
                validationErrors: [],
                createdAt: '2026-03-12T10:20:00.000Z',
              },
              {
                agentOutputId: 'vc-revise',
                caseId: 'case-revise',
                iterationId: 'iter-revise-1',
                iterationNo: 1,
                agentName: 'VCCritic',
                rawOutput: '{}',
                normalizedOutput: {
                  score_breakdown: [
                    {
                      dimension: 'Market Size',
                      score: 6,
                    },
                  ],
                },
                validationErrors: [],
                createdAt: '2026-03-12T09:50:00.000Z',
              },
              {
                agentOutputId: 'judge-revise',
                caseId: 'case-revise',
                iterationId: 'iter-revise-1',
                iterationNo: 1,
                agentName: 'Judge',
                rawOutput: '{}',
                normalizedOutput: {
                  decision: 'REVISE',
                  evidence_assessment: {
                    completeness: 6,
                    freshness: 6,
                    confidence: 6,
                  },
                },
                validationErrors: [],
                createdAt: '2026-03-12T09:55:00.000Z',
              },
            ];
          },
        },
        founderValueMeasurements: {
          async listAll() {
            return [
              {
                measurementId: 'measurement-pass-1',
                caseId: 'case-pass',
                respondentType: 'OPERATOR',
                actor: 'operator',
                perceivedUsefulnessScore: 4,
                confidenceIncreaseScore: 5,
                manualResearchMinutesSaved: 90,
                createdAt: '2026-03-12T10:25:00.000Z',
              },
              {
                measurementId: 'measurement-pass-2',
                caseId: 'case-pass',
                respondentType: 'FOUNDER',
                actor: 'founder',
                perceivedUsefulnessScore: 5,
                confidenceIncreaseScore: 4,
                manualResearchMinutesSaved: 60,
                createdAt: '2026-03-12T10:28:00.000Z',
              },
            ];
          },
        },
      },
      now: () => new Date('2026-03-12T11:00:00.000Z'),
    });

    const report = await service.collect();

    expect(report).toEqual({
      generatedAt: '2026-03-12T11:00:00.000Z',
      rankedCases: [
        {
          caseId: 'case-pass',
          topic: 'AI bookkeeping',
          status: 'COMPLETED',
          latestDecision: 'PASS',
          opportunityScore: 100,
          vcScoreAverage: 8,
          evidenceScoreAverage: 8,
          founderValueScore: 4.5,
          approvedForBuild: true,
          updatedAt: '2026-03-12T10:30:00.000Z',
        },
        {
          caseId: 'case-revise',
          topic: 'Compliance assistant',
          status: 'REVISE_REQUIRED',
          latestDecision: 'REVISE',
          opportunityScore: 69,
          vcScoreAverage: 6,
          evidenceScoreAverage: 6,
          founderValueScore: 0,
          approvedForBuild: false,
          updatedAt: '2026-03-12T10:00:00.000Z',
        },
        {
          caseId: 'case-pending',
          topic: 'Exploratory topic',
          status: 'TOPIC_ACCEPTED',
          latestDecision: 'PENDING',
          opportunityScore: 20,
          vcScoreAverage: 0,
          evidenceScoreAverage: 0,
          founderValueScore: 0,
          approvedForBuild: false,
          updatedAt: '2026-03-12T10:05:00.000Z',
        },
      ],
      summary: {
        totalCases: 3,
        averageOpportunityScore: 63,
        approvedForBuildCount: 1,
        topOpportunityCaseId: 'case-pass',
        byDecision: {
          PASS: 1,
          REVISE: 1,
          PIVOT: 0,
          REJECT: 0,
          PENDING: 1,
        },
        byStatus: {
          COMPLETED: 1,
          REVISE_REQUIRED: 1,
          TOPIC_ACCEPTED: 1,
        },
      },
    });
  });
});
