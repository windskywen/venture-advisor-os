import { describe, expect, it } from 'vitest';

import {
  createPersistenceRepositories,
  type SqlExecutor,
} from '../src/index.js';

describe('persistence repositories', () => {
  it('persists both raw and normalized agent outputs and exposes normalized outputs for downstream reads', async () => {
    const executedQueries: Array<{ sql: string; params?: readonly unknown[] }> =
      [];
    const executor: SqlExecutor = {
      async query(sql, params) {
        executedQueries.push({ sql, params });

        if (sql.includes('SELECT DISTINCT ON (agent_name)')) {
          return {
            command: 'SELECT',
            rowCount: 1,
            oid: 0,
            fields: [],
            rows: [
              {
                agent_name: 'FactResearcher',
                normalized_output: {
                  facts: [{ statement: 'The market is growing.' }],
                },
              },
            ],
          };
        }

        return {
          command: 'INSERT',
          rowCount: 1,
          oid: 0,
          fields: [],
          rows: [],
        };
      },
    };

    const repositories = createPersistenceRepositories(executor);

    await repositories.agentOutputs.create({
      agentOutputId: 'ao-1',
      caseId: 'case-1',
      iterationId: 'iter-1',
      iterationNo: 1,
      agentName: 'FactResearcher',
      rawOutput: {
        markdown: '# Raw output',
      },
      normalizedOutput: {
        facts: [{ statement: 'The market is growing.' }],
      },
      validationErrors: [],
      tokenUsage: {
        inputTokens: 100,
        outputTokens: 200,
        totalTokens: 300,
      },
      latencyMs: 1200,
      createdAt: '2026-03-12T00:00:00.000Z',
    });

    const latestNormalized =
      await repositories.agentOutputs.getLatestNormalizedByCaseId('case-1');

    expect(executedQueries[0]?.sql).toContain('INSERT INTO agent_outputs');
    expect(executedQueries[0]?.params?.[5]).toBe(
      JSON.stringify({
        markdown: '# Raw output',
      }),
    );
    expect(executedQueries[0]?.params?.[6]).toBe(
      JSON.stringify({
        facts: [{ statement: 'The market is growing.' }],
      }),
    );
    expect(latestNormalized).toEqual({
      FactResearcher: {
        facts: [{ statement: 'The market is growing.' }],
      },
    });
  });

  it('persists rejection rationale, category, and portfolio escalation metadata on cases', async () => {
    const executedQueries: Array<{ sql: string; params?: readonly unknown[] }> =
      [];
    const executor: SqlExecutor = {
      async query(sql, params) {
        executedQueries.push({ sql, params });

        if (sql.includes('SELECT * FROM opportunity_cases')) {
          return {
            command: 'SELECT',
            rowCount: 1,
            oid: 0,
            fields: [],
            rows: [
              {
                case_id: 'case-2',
                topic: 'B2B workflow automation',
                region: 'AU',
                founder_profile: 'Former operator',
                preferred_business_models: ['SaaS'],
                constraints: ['Bootstrap first'],
                research_style: 'REGULATORY_RISK',
                browsing_autonomy: {
                  profile: 'EXPANDED',
                  allowAdjacentExploration: true,
                  allowCompetitorExploration: true,
                  allowOpenEndedQueries: true,
                  maxSources: 8,
                  recencyWindowDays: 365,
                },
                status: 'REJECTED',
                current_iteration: 3,
                max_iterations: 3,
                final_decision: 'REJECT',
                failure_category: null,
                rejection_rationale:
                  'The business case stayed too weak after three iterations.',
                rejection_category:
                  'INSUFFICIENT_EVIDENCE_AFTER_ITERATION_BUDGET',
                portfolio_escalation_metadata: {
                  notifyPortfolioManager: true,
                  queueHint: 'next-topic',
                },
                manual_review_required: false,
                created_at: '2026-03-12T00:00:00.000Z',
                updated_at: '2026-03-12T00:05:00.000Z',
              },
            ],
          };
        }

        return {
          command: 'INSERT',
          rowCount: 1,
          oid: 0,
          fields: [],
          rows: [],
        };
      },
    };

    const repositories = createPersistenceRepositories(executor);

    await repositories.cases.create({
      caseId: 'case-2',
      topic: 'B2B workflow automation',
      region: 'AU',
      founderProfile: 'Former operator',
      preferredBusinessModels: ['SaaS'],
      constraints: ['Bootstrap first'],
      researchStyle: 'REGULATORY_RISK',
      browsingAutonomy: {
        profile: 'EXPANDED',
        allowAdjacentExploration: true,
        allowCompetitorExploration: true,
        allowOpenEndedQueries: true,
        maxSources: 8,
        recencyWindowDays: 365,
      },
      status: 'REJECTED',
      currentIteration: 3,
      maxIterations: 3,
      finalDecision: 'REJECT',
      rejectionRationale:
        'The business case stayed too weak after three iterations.',
      rejectionCategory: 'INSUFFICIENT_EVIDENCE_AFTER_ITERATION_BUDGET',
      portfolioEscalationMetadata: {
        notifyPortfolioManager: true,
        queueHint: 'next-topic',
      },
      manualReviewRequired: false,
      createdAt: '2026-03-12T00:00:00.000Z',
      updatedAt: '2026-03-12T00:05:00.000Z',
    });

    const caseRecord = await repositories.cases.getById('case-2');

    expect(executedQueries[0]?.sql).toContain('INSERT INTO opportunity_cases');
    expect(executedQueries[0]?.params?.[6]).toBe('REGULATORY_RISK');
    expect(executedQueries[0]?.params?.[7]).toBe(
      JSON.stringify({
        profile: 'EXPANDED',
        allowAdjacentExploration: true,
        allowCompetitorExploration: true,
        allowOpenEndedQueries: true,
        maxSources: 8,
        recencyWindowDays: 365,
      }),
    );
    expect(executedQueries[0]?.params?.[15]).toBe(
      'The business case stayed too weak after three iterations.',
    );
    expect(executedQueries[0]?.params?.[16]).toBe(
      'INSUFFICIENT_EVIDENCE_AFTER_ITERATION_BUDGET',
    );
    expect(executedQueries[0]?.params?.[17]).toBe(
      JSON.stringify({
        notifyPortfolioManager: true,
        queueHint: 'next-topic',
      }),
    );
    expect(caseRecord).toEqual({
      caseId: 'case-2',
      topic: 'B2B workflow automation',
      region: 'AU',
      founderProfile: 'Former operator',
      preferredBusinessModels: ['SaaS'],
      constraints: ['Bootstrap first'],
      researchStyle: 'REGULATORY_RISK',
      browsingAutonomy: {
        profile: 'EXPANDED',
        allowAdjacentExploration: true,
        allowCompetitorExploration: true,
        allowOpenEndedQueries: true,
        maxSources: 8,
        recencyWindowDays: 365,
      },
      status: 'REJECTED',
      currentIteration: 3,
      maxIterations: 3,
      finalDecision: 'REJECT',
      rejectionRationale:
        'The business case stayed too weak after three iterations.',
      rejectionCategory: 'INSUFFICIENT_EVIDENCE_AFTER_ITERATION_BUDGET',
      portfolioEscalationMetadata: {
        notifyPortfolioManager: true,
        queueHint: 'next-topic',
      },
      manualReviewRequired: false,
      createdAt: '2026-03-12T00:00:00.000Z',
      updatedAt: '2026-03-12T00:05:00.000Z',
    });
  });

  it('persists approved source iteration refs for pass-to-prd promotion', async () => {
    const executedQueries: Array<{ sql: string; params?: readonly unknown[] }> =
      [];
    const executor: SqlExecutor = {
      async query(sql, params) {
        executedQueries.push({ sql, params });

        return {
          command: 'UPDATE',
          rowCount: 1,
          oid: 0,
          fields: [],
          rows: [
            {
              case_id: 'case-3',
              topic: 'AI analyst copilot',
              region: 'US',
              founder_profile: 'Operator-founder',
              preferred_business_models: ['SaaS'],
              constraints: [],
              status: 'APPROVED_FOR_PRD',
              current_iteration: 3,
              max_iterations: 3,
              approved_source_iteration_id: 'iter-3',
              approved_source_iteration_no: 3,
              final_decision: 'PASS',
              failure_category: null,
              rejection_rationale: null,
              rejection_category: null,
              portfolio_escalation_metadata: {},
              manual_review_required: false,
              created_at: '2026-03-12T00:00:00.000Z',
              updated_at: '2026-03-12T00:05:00.000Z',
            },
          ],
        };
      },
    };

    const repositories = createPersistenceRepositories(executor);

    const updatedCase = await repositories.cases.update({
      caseId: 'case-3',
      topic: 'AI analyst copilot',
      region: 'US',
      founderProfile: 'Operator-founder',
      preferredBusinessModels: ['SaaS'],
      constraints: [],
      status: 'APPROVED_FOR_PRD',
      currentIteration: 3,
      maxIterations: 3,
      approvedSourceIterationId: 'iter-3',
      approvedSourceIterationNo: 3,
      finalDecision: 'PASS',
      manualReviewRequired: false,
      createdAt: '2026-03-12T00:00:00.000Z',
      updatedAt: '2026-03-12T00:05:00.000Z',
    });

    expect(executedQueries[0]?.sql).toContain('approved_source_iteration_id');
    expect(executedQueries[0]?.params?.[9]).toBe('iter-3');
    expect(executedQueries[0]?.params?.[10]).toBe(3);
    expect(updatedCase.approvedSourceIterationId).toBe('iter-3');
    expect(updatedCase.approvedSourceIterationNo).toBe(3);
  });

  it('persists founder-value measurements for lightweight operator feedback capture', async () => {
    const executedQueries: Array<{ sql: string; params?: readonly unknown[] }> =
      [];
    const executor: SqlExecutor = {
      async query(sql, params) {
        executedQueries.push({ sql, params });

        if (sql.includes('FROM founder_value_measurements')) {
          return {
            command: 'SELECT',
            rowCount: 1,
            oid: 0,
            fields: [],
            rows: [
              {
                measurement_id: 'measurement-1',
                case_id: 'case-4',
                respondent_type: 'OPERATOR',
                actor: 'operator',
                perceived_usefulness_score: 4,
                confidence_increase_score: 5,
                manual_research_minutes_saved: 90,
                notes: 'Useful for prioritizing follow-up work.',
                created_at: '2026-03-12T00:10:00.000Z',
              },
            ],
          };
        }

        return {
          command: 'INSERT',
          rowCount: 1,
          oid: 0,
          fields: [],
          rows: [],
        };
      },
    };

    const repositories = createPersistenceRepositories(executor);

    await repositories.founderValueMeasurements.create({
      measurementId: 'measurement-1',
      caseId: 'case-4',
      respondentType: 'OPERATOR',
      actor: 'operator',
      perceivedUsefulnessScore: 4,
      confidenceIncreaseScore: 5,
      manualResearchMinutesSaved: 90,
      notes: 'Useful for prioritizing follow-up work.',
      createdAt: '2026-03-12T00:10:00.000Z',
    });

    const measurements =
      await repositories.founderValueMeasurements.listByCaseId('case-4');

    expect(executedQueries[0]?.sql).toContain(
      'INSERT INTO founder_value_measurements',
    );
    expect(executedQueries[0]?.params?.[4]).toBe(4);
    expect(executedQueries[0]?.params?.[5]).toBe(5);
    expect(executedQueries[0]?.params?.[6]).toBe(90);
    expect(measurements).toEqual([
      {
        measurementId: 'measurement-1',
        caseId: 'case-4',
        respondentType: 'OPERATOR',
        actor: 'operator',
        perceivedUsefulnessScore: 4,
        confidenceIncreaseScore: 5,
        manualResearchMinutesSaved: 90,
        notes: 'Useful for prioritizing follow-up work.',
        createdAt: '2026-03-12T00:10:00.000Z',
      },
    ]);
  });
});
