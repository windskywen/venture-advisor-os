import { describe, expect, it } from 'vitest';

import { composeImplementationHandoff } from '../src/index.js';

describe('implementation handoff composition', () => {
  it('composes a structured Codex/Copilot handoff bundle from approved outputs', () => {
    const artifact = composeImplementationHandoff({
      caseId: 'case-123',
      approvedIterationNo: 2,
      generatedAt: '2026-03-12T13:00:00.000Z',
      approvedBusinessSummary: {
        caseId: 'case-123',
        approvedIterationNo: 2,
        generatedAt: '2026-03-12T12:00:00.000Z',
        sourceOutputRefs: [
          'iteration:2:FactResearcher',
          'iteration:2:OpportunityStrategist',
          'iteration:2:VCCritic',
          'iteration:2:Judge',
        ],
        summary: {
          topic: 'AI bookkeeping for freelancers',
          market_problem_definition:
            'Freelancers waste time on manual bookkeeping.',
          target_user_segments: ['Solo freelancers'],
          recommended_entry_point: {
            title: 'AI bookkeeping assistant',
          },
        },
      },
      prd: {
        product_overview:
          'An AI bookkeeping assistant for solo freelancers and small agencies.',
        problem_statement:
          'Manual bookkeeping and month-end close work remain slow and error-prone.',
        target_users: ['Solo freelancers'],
        use_cases: ['Review categorized transactions'],
        functional_requirements: ['Connect financial accounts securely'],
        non_functional_requirements: ['Return dashboard data in under 2 seconds'],
        mvp_scope: ['Transaction categorization'],
        out_of_scope: ['Payroll'],
        user_stories: [
          'As a freelancer, I want AI suggestions so I can close my books faster.',
        ],
        success_metrics: ['Reduce month-end close time by 50%'],
        risks: ['Users may distrust automated categorizations'],
        open_questions: ['Should accountant collaboration be in MVP?'],
      },
      poc: {
        poc_goal:
          'Validate that freelancers trust AI-assisted bookkeeping suggestions.',
        validation_hypotheses: ['Users will review AI suggestions'],
        demo_scope: ['Upload transactions'],
        technical_architecture: ['Web UI', 'API service'],
        core_modules: ['Upload flow', 'Review queue'],
        data_inputs: ['CSV transaction export'],
        mock_vs_real: ['Real CSV uploads', 'Mock bank feed sync'],
        acceptance_criteria: ['Users complete review in under 10 minutes'],
        build_tasks: ['Build upload flow', 'Build review queue'],
        risks_and_fallback: [
          'If accuracy is too low, fall back to deterministic rules plus manual confirmation',
        ],
      },
      artifactRefs: {
        approvedBusinessSummary:
          'storage/cases/case-123/approved_business_summary.json',
        finalBusinessPlan: 'storage/cases/case-123/final_business_plan.md',
        prd: 'storage/cases/case-123/prd.md',
        pocSpec: 'storage/cases/case-123/poc_spec.md',
        codexExecutionPlan: 'storage/cases/case-123/codex_execution_plan.md',
      },
    });

    expect(artifact).toEqual({
      caseId: 'case-123',
      approvedIterationNo: 2,
      generatedAt: '2026-03-12T13:00:00.000Z',
      sourceOutputRefs: [
        'iteration:2:FactResearcher',
        'iteration:2:OpportunityStrategist',
        'iteration:2:VCCritic',
        'iteration:2:Judge',
        'iteration:2:PRDStrategist',
        'iteration:2:POCArchitect',
      ],
      artifactRefs: {
        approvedBusinessSummary:
          'storage/cases/case-123/approved_business_summary.json',
        finalBusinessPlan: 'storage/cases/case-123/final_business_plan.md',
        prd: 'storage/cases/case-123/prd.md',
        pocSpec: 'storage/cases/case-123/poc_spec.md',
        codexExecutionPlan: 'storage/cases/case-123/codex_execution_plan.md',
      },
      implementationBrief: {
        topic: 'AI bookkeeping for freelancers',
        marketProblemDefinition:
          'Freelancers waste time on manual bookkeeping.',
        targetUserSegments: ['Solo freelancers'],
        recommendedEntryPoint: 'AI bookkeeping assistant',
        productOverview:
          'An AI bookkeeping assistant for solo freelancers and small agencies.',
        useCases: ['Review categorized transactions'],
        mvpScope: ['Transaction categorization'],
        functionalRequirements: ['Connect financial accounts securely'],
        nonFunctionalRequirements: ['Return dashboard data in under 2 seconds'],
        technicalArchitecture: ['Web UI', 'API service'],
        coreModules: ['Upload flow', 'Review queue'],
        buildTasks: ['Build upload flow', 'Build review queue'],
        mockVsReal: ['Real CSV uploads', 'Mock bank feed sync'],
        successMetrics: ['Reduce month-end close time by 50%'],
        risks: [
          'Users may distrust automated categorizations',
          'If accuracy is too low, fall back to deterministic rules plus manual confirmation',
        ],
        openQuestions: ['Should accountant collaboration be in MVP?'],
      },
      codexExecutionPlan: {
        starterPrompt:
          'Implement AI bookkeeping assistant for AI bookkeeping for freelancers. Start with Build upload flow. Keep the build inside the MVP scope: Transaction categorization.',
        bootstrapTasks: ['Build upload flow', 'Build review queue'],
        validationChecklist: [
          'Reduce month-end close time by 50%',
          'Return dashboard data in under 2 seconds',
          'Real CSV uploads',
          'Mock bank feed sync',
        ],
      },
    });
  });
});
