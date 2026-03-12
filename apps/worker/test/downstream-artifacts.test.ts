import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { createFileStorageAdapter } from '@venture-advisor-os/persistence';
import {
  createStructuredLogger,
  type StructuredLogEntry,
} from '@venture-advisor-os/shared-types';

import {
  createDownstreamArtifactService,
  type DownstreamArtifactStorage,
} from '../src/index.js';

describe('downstream artifact service', () => {
  const storageRoots: string[] = [];

  afterEach(async () => {
    for (const storageRoot of storageRoots.splice(0)) {
      await createFileStorageAdapter({
        storageRootDirectory: storageRoot,
      }).deleteCaseWorkspace('case-1');
    }
  });

  it('re-generates missing PRD and POC artifacts with approved-iteration trace metadata', async () => {
    const files = new Map<string, string>();
    const storage = createInMemoryStorage(files);
    const service = createDownstreamArtifactService({
      repositories: {
        cases: {
          async getById(caseId) {
            return {
              caseId,
              topic: 'AI bookkeeping for freelancers',
              preferredBusinessModels: ['Monthly SaaS subscription'],
              constraints: [],
              status: 'COMPLETED',
              currentIteration: 2,
              maxIterations: 3,
              approvedSourceIterationId: 'iter-2',
              approvedSourceIterationNo: 2,
              finalDecision: 'PASS',
              portfolioEscalationMetadata: {},
              manualReviewRequired: false,
              createdAt: '2026-03-12T10:00:00.000Z',
              updatedAt: '2026-03-12T10:30:00.000Z',
            };
          },
        },
        agentOutputs: {
          async listByCaseId(caseId) {
            return [
              {
                agentOutputId: 'prd-1',
                caseId,
                iterationId: 'iter-2',
                iterationNo: 2,
                agentName: 'PRDStrategist',
                rawOutput: '{}',
                normalizedOutput: {
                  product_overview:
                    'An AI bookkeeping assistant for solo operators.',
                  problem_statement:
                    'Manual bookkeeping is too slow for solo freelancers.',
                  target_users: ['Solo freelancers'],
                  use_cases: ['Review AI-suggested categorizations'],
                  functional_requirements: ['Categorize transactions'],
                  non_functional_requirements: ['Return results in under 2 seconds'],
                  mvp_scope: ['Categorization review'],
                  out_of_scope: ['Payroll'],
                  user_stories: [
                    'As a freelancer, I want fast categorization suggestions.',
                  ],
                  success_metrics: ['Reduce close time by 50%'],
                  risks: ['Users may distrust automation'],
                  open_questions: ['Do users need accountant collaboration in MVP?'],
                },
                validationErrors: [],
                createdAt: '2026-03-12T10:15:00.000Z',
              },
              {
                agentOutputId: 'poc-1',
                caseId,
                iterationId: 'iter-2',
                iterationNo: 2,
                agentName: 'POCArchitect',
                rawOutput: '{}',
                normalizedOutput: {
                  poc_goal:
                    'Validate trust in AI-assisted bookkeeping suggestions.',
                  validation_hypotheses: [
                    'Freelancers will review AI suggestions instead of editing from scratch',
                  ],
                  demo_scope: ['Upload transactions', 'Review suggestions'],
                  technical_architecture: ['Web UI', 'API', 'LLM-backed categorizer'],
                  core_modules: ['Upload', 'Review queue'],
                  data_inputs: ['CSV transaction export'],
                  mock_vs_real: ['Real CSV uploads', 'Mock bank sync'],
                  acceptance_criteria: [
                    'Users complete review in under 10 minutes',
                  ],
                  build_tasks: ['Build upload flow', 'Build review queue'],
                  risks_and_fallback: [
                    'If accuracy is low, fall back to deterministic rules plus manual confirmation',
                  ],
                },
                validationErrors: [],
                createdAt: '2026-03-12T10:20:00.000Z',
              },
            ];
          },
        },
      },
      storage,
      now: () => new Date('2026-03-12T12:00:00.000Z'),
    });

    const result = await service.ensurePocArtifact('case-1');

    expect(result).toEqual({
      caseId: 'case-1',
      approvedIterationNo: 2,
      artifactPath: 'storage/cases/case-1/poc_spec.md',
      created: true,
    });
    expect(files.get('storage/cases/case-1/prd.md')).toContain(
      '- Approved Iteration: 2',
    );
    expect(files.get('storage/cases/case-1/poc_spec.md')).toContain(
      '- Approved Iteration: 2',
    );
    expect(files.get('storage/cases/case-1/poc_spec.md')).toContain(
      '## Risks and Fallback Plan',
    );
  });

  it('does not overwrite an existing PRD artifact during safe regeneration', async () => {
    const files = new Map<string, string>([
      ['storage/cases/case-1/prd.md', '# Existing PRD\n'],
    ]);
    const storage = createInMemoryStorage(files);
    const service = createDownstreamArtifactService({
      repositories: {
        cases: {
          async getById(caseId) {
            return {
              caseId,
              topic: 'AI bookkeeping for freelancers',
              preferredBusinessModels: [],
              constraints: [],
              status: 'COMPLETED',
              currentIteration: 2,
              maxIterations: 3,
              approvedSourceIterationId: 'iter-2',
              approvedSourceIterationNo: 2,
              finalDecision: 'PASS',
              portfolioEscalationMetadata: {},
              manualReviewRequired: false,
              createdAt: '2026-03-12T10:00:00.000Z',
              updatedAt: '2026-03-12T10:30:00.000Z',
            };
          },
        },
        agentOutputs: {
          async listByCaseId(caseId) {
            return [
              {
                agentOutputId: 'prd-1',
                caseId,
                iterationId: 'iter-2',
                iterationNo: 2,
                agentName: 'PRDStrategist',
                rawOutput: '{}',
                normalizedOutput: {
                  product_overview: 'overview',
                  problem_statement: 'problem',
                  target_users: ['user'],
                  use_cases: ['use case'],
                  functional_requirements: ['requirement'],
                  non_functional_requirements: ['nfr'],
                  mvp_scope: ['scope'],
                  out_of_scope: ['out'],
                  user_stories: ['story'],
                  success_metrics: ['metric'],
                  risks: ['risk'],
                  open_questions: ['question'],
                },
                validationErrors: [],
                createdAt: '2026-03-12T10:15:00.000Z',
              },
            ];
          },
        },
      },
      storage,
    });

    const result = await service.ensurePrdArtifact('case-1');

    expect(result).toEqual({
      caseId: 'case-1',
      approvedIterationNo: 2,
      artifactPath: 'storage/cases/case-1/prd.md',
      created: false,
    });
    expect(files.get('storage/cases/case-1/prd.md')).toBe('# Existing PRD\n');
  });

  it('produces an implementation handoff bundle and materializes its referenced artifacts', async () => {
    const files = new Map<string, string>();
    const storage = createInMemoryStorage(files);
    const service = createDownstreamArtifactService({
      repositories: {
        cases: {
          async getById(caseId) {
            return {
              caseId,
              topic: 'AI bookkeeping for freelancers',
              region: 'Australia',
              founderProfile: 'Founder previously ran a bookkeeping practice.',
              preferredBusinessModels: ['Monthly SaaS subscription'],
              constraints: ['Keep onboarding under 10 minutes'],
              status: 'COMPLETED',
              currentIteration: 2,
              maxIterations: 3,
              approvedSourceIterationId: 'iter-2',
              approvedSourceIterationNo: 2,
              finalDecision: 'PASS',
              portfolioEscalationMetadata: {},
              manualReviewRequired: false,
              createdAt: '2026-03-12T10:00:00.000Z',
              updatedAt: '2026-03-12T10:30:00.000Z',
            };
          },
        },
        agentOutputs: {
          async listByCaseId(caseId) {
            return [
              {
                agentOutputId: 'a-1',
                caseId,
                iterationId: 'iter-2',
                iterationNo: 2,
                agentName: 'FactResearcher',
                rawOutput: '{}',
                normalizedOutput: {
                  market_problem_definition:
                    'Freelancers waste time on manual bookkeeping.',
                  target_user_segments: ['Solo freelancers'],
                  pain_points: ['Month-end close takes too long'],
                  workflow_gaps: ['No lightweight automation for mixed income'],
                  current_alternatives: ['Spreadsheets'],
                  competitors: [],
                  evidence: [],
                  assumptions: ['Users will connect data sources'],
                },
                validationErrors: [],
                createdAt: '2026-03-12T10:01:00.000Z',
              },
              {
                agentOutputId: 'b-1',
                caseId,
                iterationId: 'iter-2',
                iterationNo: 2,
                agentName: 'OpportunityStrategist',
                rawOutput: '{}',
                normalizedOutput: {
                  opportunity_options: [
                    {
                      title: 'AI bookkeeping assistant',
                      product_shape: 'Workflow software',
                      target_user: 'Solo freelancers',
                      core_pain: 'Manual categorization and reconciliation',
                      monetization: 'Monthly SaaS subscription',
                      pros: ['High-frequency workflow'],
                      cons: ['Trust barrier'],
                    },
                  ],
                  recommended_entry_point: {
                    title: 'AI bookkeeping assistant',
                    rationale:
                      'It removes a recurring high-friction workflow.',
                  },
                  business_model_hypotheses: ['Monthly SaaS subscription'],
                  mvp_direction: ['Automated categorization'],
                  feasibility_scores: [
                    {
                      dimension: 'distribution',
                      score: 7,
                      rationale: 'Accessible through freelancer communities.',
                    },
                  ],
                  key_assumptions: [
                    'Users will review AI-generated categorizations',
                  ],
                },
                validationErrors: [],
                createdAt: '2026-03-12T10:02:00.000Z',
              },
              {
                agentOutputId: 'c-1',
                caseId,
                iterationId: 'iter-2',
                iterationNo: 2,
                agentName: 'VCCritic',
                rawOutput: '{}',
                normalizedOutput: {
                  summary: 'Viable if trust and onboarding are handled carefully.',
                  objections: ['Trust in automation'],
                  fatal_flaws: [],
                  manageable_risks: ['Need human-review workflows'],
                  score_breakdown: [],
                  key_questions: ['How quickly can users trust automation?'],
                  recommendation: 'Proceed to validation and productization.',
                },
                validationErrors: [],
                createdAt: '2026-03-12T10:03:00.000Z',
              },
              {
                agentOutputId: 'j-1',
                caseId,
                iterationId: 'iter-2',
                iterationNo: 2,
                agentName: 'Judge',
                rawOutput: '{}',
                normalizedOutput: {
                  decision: 'PASS',
                  rationale:
                    'Evidence is strong enough and objections are manageable.',
                  accepted_objections: ['Trust in automation'],
                  rejected_objections: [],
                  evidence_assessment: {
                    completeness: 8,
                    freshness: 8,
                    confidence: 7,
                  },
                  iteration_worthiness: {
                    should_continue: false,
                    reason:
                      'The opportunity is ready for downstream product planning.',
                  },
                  next_iteration_tasks: [],
                  termination_warning: false,
                },
                validationErrors: [],
                createdAt: '2026-03-12T10:04:00.000Z',
              },
              {
                agentOutputId: 'prd-1',
                caseId,
                iterationId: 'iter-2',
                iterationNo: 2,
                agentName: 'PRDStrategist',
                rawOutput: '{}',
                normalizedOutput: {
                  product_overview:
                    'An AI bookkeeping assistant for solo operators.',
                  problem_statement:
                    'Manual bookkeeping is too slow for solo freelancers.',
                  target_users: ['Solo freelancers'],
                  use_cases: ['Review AI-suggested categorizations'],
                  functional_requirements: ['Categorize transactions'],
                  non_functional_requirements: [
                    'Return results in under 2 seconds',
                  ],
                  mvp_scope: ['Categorization review'],
                  out_of_scope: ['Payroll'],
                  user_stories: [
                    'As a freelancer, I want fast categorization suggestions.',
                  ],
                  success_metrics: ['Reduce close time by 50%'],
                  risks: ['Users may distrust automation'],
                  open_questions: [
                    'Do users need accountant collaboration in MVP?',
                  ],
                },
                validationErrors: [],
                createdAt: '2026-03-12T10:15:00.000Z',
              },
              {
                agentOutputId: 'poc-1',
                caseId,
                iterationId: 'iter-2',
                iterationNo: 2,
                agentName: 'POCArchitect',
                rawOutput: '{}',
                normalizedOutput: {
                  poc_goal:
                    'Validate trust in AI-assisted bookkeeping suggestions.',
                  validation_hypotheses: [
                    'Freelancers will review AI suggestions instead of editing from scratch',
                  ],
                  demo_scope: ['Upload transactions', 'Review suggestions'],
                  technical_architecture: [
                    'Web UI',
                    'API',
                    'LLM-backed categorizer',
                  ],
                  core_modules: ['Upload', 'Review queue'],
                  data_inputs: ['CSV transaction export'],
                  mock_vs_real: ['Real CSV uploads', 'Mock bank sync'],
                  acceptance_criteria: [
                    'Users complete review in under 10 minutes',
                  ],
                  build_tasks: ['Build upload flow', 'Build review queue'],
                  risks_and_fallback: [
                    'If accuracy is low, fall back to deterministic rules plus manual confirmation',
                  ],
                },
                validationErrors: [],
                createdAt: '2026-03-12T10:20:00.000Z',
              },
            ];
          },
        },
      },
      storage,
      now: () => new Date('2026-03-12T12:00:00.000Z'),
    });

    const result = await service.ensureImplementationHandoff('case-1');

    expect(result).toEqual({
      caseId: 'case-1',
      approvedIterationNo: 2,
      artifactPath: 'storage/cases/case-1/implementation_handoff.json',
      created: true,
    });
    expect(files.get('storage/cases/case-1/approved_business_summary.json')).toContain(
      '"approvedIterationNo": 2',
    );
    expect(files.get('storage/cases/case-1/final_business_plan.md')).toContain(
      '# Final Business Plan',
    );
    expect(files.get('storage/cases/case-1/implementation_handoff.json')).toContain(
      '"recommendedEntryPoint": "AI bookkeeping assistant"',
    );
    expect(files.get('storage/cases/case-1/implementation_handoff.json')).toContain(
      '"pocSpec": "storage/cases/case-1/poc_spec.md"',
    );
    expect(files.get('storage/cases/case-1/implementation_handoff.json')).toContain(
      '"codexExecutionPlan": "storage/cases/case-1/codex_execution_plan.md"',
    );
    expect(files.get('storage/cases/case-1/codex_execution_plan.md')).toContain(
      '# Codex Execution Plan',
    );
    expect(files.get('storage/cases/case-1/codex_execution_plan.md')).toContain(
      '## Starter Prompt',
    );
  });

  it('writes downstream artifacts only inside the managed case workspace', async () => {
    const storageRoot = await mkdtemp(join(tmpdir(), 'venture-advisor-os-worker-'));
    storageRoots.push(storageRoot);

    const realStorage = createFileStorageAdapter({
      storageRootDirectory: storageRoot,
    });
    const service = createDownstreamArtifactService({
      repositories: {
        cases: {
          async getById(caseId) {
            return {
              caseId,
              topic: 'AI bookkeeping for freelancers',
              status: 'COMPLETED',
              currentIteration: 2,
              maxIterations: 3,
              approvedSourceIterationId: 'iter-2',
              approvedSourceIterationNo: 2,
              finalDecision: 'PASS',
              preferredBusinessModels: [],
              constraints: [],
              portfolioEscalationMetadata: {},
              manualReviewRequired: false,
              createdAt: '2026-03-12T10:00:00.000Z',
              updatedAt: '2026-03-12T10:30:00.000Z',
            };
          },
        },
        agentOutputs: {
          async listByCaseId(caseId) {
            return [
              {
                agentOutputId: 'a-1',
                caseId,
                iterationId: 'iter-2',
                iterationNo: 2,
                agentName: 'FactResearcher',
                rawOutput: '{}',
                normalizedOutput: {
                  market_problem_definition:
                    'Freelancers waste time on manual bookkeeping.',
                  target_user_segments: ['Solo freelancers'],
                  pain_points: ['Month-end close takes too long'],
                  workflow_gaps: ['No lightweight automation for mixed income'],
                  current_alternatives: ['Spreadsheets'],
                  competitors: [],
                  evidence: [],
                  assumptions: ['Users will connect data sources'],
                },
                validationErrors: [],
                createdAt: '2026-03-12T10:01:00.000Z',
              },
              {
                agentOutputId: 'b-1',
                caseId,
                iterationId: 'iter-2',
                iterationNo: 2,
                agentName: 'OpportunityStrategist',
                rawOutput: '{}',
                normalizedOutput: {
                  opportunity_options: [
                    {
                      title: 'AI bookkeeping assistant',
                      product_shape: 'Workflow software',
                      target_user: 'Solo freelancers',
                      core_pain: 'Manual categorization and reconciliation',
                      monetization: 'Monthly SaaS subscription',
                      pros: ['High-frequency workflow'],
                      cons: ['Trust barrier'],
                    },
                  ],
                  recommended_entry_point: {
                    title: 'AI bookkeeping assistant',
                    rationale:
                      'It removes a recurring high-friction workflow.',
                  },
                  business_model_hypotheses: ['Monthly SaaS subscription'],
                  mvp_direction: ['Automated categorization'],
                  feasibility_scores: [
                    {
                      dimension: 'distribution',
                      score: 7,
                      rationale: 'Accessible through freelancer communities.',
                    },
                  ],
                  key_assumptions: [
                    'Users will review AI-generated categorizations',
                  ],
                },
                validationErrors: [],
                createdAt: '2026-03-12T10:02:00.000Z',
              },
              {
                agentOutputId: 'c-1',
                caseId,
                iterationId: 'iter-2',
                iterationNo: 2,
                agentName: 'VCCritic',
                rawOutput: '{}',
                normalizedOutput: {
                  summary: 'Viable if trust and onboarding are handled carefully.',
                  objections: ['Trust in automation'],
                  fatal_flaws: [],
                  manageable_risks: ['Need human-review workflows'],
                  score_breakdown: [],
                  key_questions: ['How quickly can users trust automation?'],
                  recommendation: 'Proceed to validation and productization.',
                },
                validationErrors: [],
                createdAt: '2026-03-12T10:03:00.000Z',
              },
              {
                agentOutputId: 'j-1',
                caseId,
                iterationId: 'iter-2',
                iterationNo: 2,
                agentName: 'Judge',
                rawOutput: '{}',
                normalizedOutput: {
                  decision: 'PASS',
                  rationale:
                    'Evidence is strong enough and objections are manageable.',
                  accepted_objections: ['Trust in automation'],
                  rejected_objections: [],
                  evidence_assessment: {
                    completeness: 8,
                    freshness: 8,
                    confidence: 7,
                  },
                  iteration_worthiness: {
                    should_continue: false,
                    reason:
                      'The opportunity is ready for downstream product planning.',
                  },
                  next_iteration_tasks: [],
                  termination_warning: false,
                },
                validationErrors: [],
                createdAt: '2026-03-12T10:04:00.000Z',
              },
              {
                agentOutputId: 'prd-1',
                caseId,
                iterationId: 'iter-2',
                iterationNo: 2,
                agentName: 'PRDStrategist',
                rawOutput: '{}',
                normalizedOutput: {
                  product_overview:
                    'An AI bookkeeping assistant for solo operators.',
                  problem_statement:
                    'Manual bookkeeping is too slow for solo freelancers.',
                  target_users: ['Solo freelancers'],
                  use_cases: ['Review AI-suggested categorizations'],
                  functional_requirements: ['Categorize transactions'],
                  non_functional_requirements: [
                    'Return results in under 2 seconds',
                  ],
                  mvp_scope: ['Categorization review'],
                  out_of_scope: ['Payroll'],
                  user_stories: [
                    'As a freelancer, I want fast categorization suggestions.',
                  ],
                  success_metrics: ['Reduce close time by 50%'],
                  risks: ['Users may distrust automation'],
                  open_questions: [
                    'Do users need accountant collaboration in MVP?',
                  ],
                },
                validationErrors: [],
                createdAt: '2026-03-12T10:15:00.000Z',
              },
              {
                agentOutputId: 'poc-1',
                caseId,
                iterationId: 'iter-2',
                iterationNo: 2,
                agentName: 'POCArchitect',
                rawOutput: '{}',
                normalizedOutput: {
                  poc_goal:
                    'Validate trust in AI-assisted bookkeeping suggestions.',
                  validation_hypotheses: [
                    'Freelancers will review AI suggestions instead of editing from scratch',
                  ],
                  demo_scope: ['Upload transactions', 'Review suggestions'],
                  technical_architecture: [
                    'Web UI',
                    'API',
                    'LLM-backed categorizer',
                  ],
                  core_modules: ['Upload', 'Review queue'],
                  data_inputs: ['CSV transaction export'],
                  mock_vs_real: ['Real CSV uploads', 'Mock bank sync'],
                  acceptance_criteria: [
                    'Users complete review in under 10 minutes',
                  ],
                  build_tasks: ['Build upload flow', 'Build review queue'],
                  risks_and_fallback: [
                    'If accuracy is low, fall back to deterministic rules plus manual confirmation',
                  ],
                },
                validationErrors: [],
                createdAt: '2026-03-12T10:20:00.000Z',
              },
            ];
          },
        },
      },
      storage: realStorage,
      now: () => new Date('2026-03-12T12:00:00.000Z'),
    });

    await service.ensureImplementationHandoff('case-1');
    const artifacts = await realStorage.listCaseArtifacts('case-1');

    expect(artifacts.length).toBeGreaterThan(0);
    expect(
      artifacts.every((artifact) =>
        artifact.relativePath.startsWith('storage/cases/case-1/'),
      ),
    ).toBe(true);
  });

  it('logs downstream storage paths for created and reused artifacts', async () => {
    const createdEntries: StructuredLogEntry[] = [];
    const reusedEntries: StructuredLogEntry[] = [];

    const createdService = createDownstreamArtifactService({
      repositories: {
        cases: {
          async getById(caseId) {
            return {
              caseId,
              topic: 'AI bookkeeping for freelancers',
              preferredBusinessModels: ['Monthly SaaS subscription'],
              constraints: [],
              status: 'COMPLETED',
              currentIteration: 2,
              maxIterations: 3,
              approvedSourceIterationId: 'iter-2',
              approvedSourceIterationNo: 2,
              finalDecision: 'PASS',
              portfolioEscalationMetadata: {},
              manualReviewRequired: false,
              createdAt: '2026-03-12T10:00:00.000Z',
              updatedAt: '2026-03-12T10:30:00.000Z',
            };
          },
        },
        agentOutputs: {
          async listByCaseId(caseId) {
            return [
              {
                agentOutputId: 'prd-1',
                caseId,
                iterationId: 'iter-2',
                iterationNo: 2,
                agentName: 'PRDStrategist',
                rawOutput: '{}',
                normalizedOutput: {
                  product_overview: 'overview',
                  problem_statement: 'problem',
                  target_users: ['user'],
                  use_cases: ['use case'],
                  functional_requirements: ['requirement'],
                  non_functional_requirements: ['nfr'],
                  mvp_scope: ['scope'],
                  out_of_scope: ['out'],
                  user_stories: ['story'],
                  success_metrics: ['metric'],
                  risks: ['risk'],
                  open_questions: ['question'],
                },
                validationErrors: [],
                createdAt: '2026-03-12T10:15:00.000Z',
              },
            ];
          },
        },
      },
      storage: createInMemoryStorage(new Map<string, string>()),
      logger: createStructuredLogger({
        now: () => new Date('2026-03-12T12:00:00.000Z'),
        write(_line, entry) {
          createdEntries.push(entry);
        },
      }),
    });
    const reusedService = createDownstreamArtifactService({
      repositories: {
        cases: {
          async getById(caseId) {
            return {
              caseId,
              topic: 'AI bookkeeping for freelancers',
              preferredBusinessModels: ['Monthly SaaS subscription'],
              constraints: [],
              status: 'COMPLETED',
              currentIteration: 2,
              maxIterations: 3,
              approvedSourceIterationId: 'iter-2',
              approvedSourceIterationNo: 2,
              finalDecision: 'PASS',
              portfolioEscalationMetadata: {},
              manualReviewRequired: false,
              createdAt: '2026-03-12T10:00:00.000Z',
              updatedAt: '2026-03-12T10:30:00.000Z',
            };
          },
        },
        agentOutputs: {
          async listByCaseId() {
            return [];
          },
        },
      },
      storage: createInMemoryStorage(
        new Map<string, string>([['storage/cases/case-1/prd.md', '# Existing PRD\n']]),
      ),
      logger: createStructuredLogger({
        now: () => new Date('2026-03-12T12:05:00.000Z'),
        write(_line, entry) {
          reusedEntries.push(entry);
        },
      }),
    });

    await createdService.ensurePrdArtifact('case-1');
    await reusedService.ensurePrdArtifact('case-1');

    expect(createdEntries).toContainEqual({
      timestamp: '2026-03-12T12:00:00.000Z',
      level: 'info',
      event: 'storage.artifact.written',
      message: 'Wrote a downstream artifact to storage.',
      context: {
        caseId: 'case-1',
        iterationId: 'iter-2',
        approvedIterationNo: 2,
        artifactType: 'prd',
        artifactPath: 'storage/cases/case-1/prd.md',
      },
    });
    expect(reusedEntries).toContainEqual({
      timestamp: '2026-03-12T12:05:00.000Z',
      level: 'info',
      event: 'storage.artifact.reused',
      message: 'Reused an existing downstream artifact path.',
      context: {
        caseId: 'case-1',
        iterationId: 'iter-2',
        approvedIterationNo: 2,
        artifactType: 'prd',
        artifactPath: 'storage/cases/case-1/prd.md',
      },
    });
  });
});

function createInMemoryStorage(
  files: Map<string, string>,
): DownstreamArtifactStorage {
  return {
    getCaseManifest(caseId) {
      return {
        approvedBusinessSummaryFile: `storage/cases/${caseId}/approved_business_summary.json`,
        finalBusinessPlanFile: `storage/cases/${caseId}/final_business_plan.md`,
        prdFile: `storage/cases/${caseId}/prd.md`,
        pocSpecFile: `storage/cases/${caseId}/poc_spec.md`,
        implementationHandoffFile: `storage/cases/${caseId}/implementation_handoff.json`,
        codexExecutionPlanFile: `storage/cases/${caseId}/codex_execution_plan.md`,
      };
    },
    async readText(relativePath) {
      return files.get(relativePath) ?? null;
    },
    async writeApprovedBusinessSummary(caseId, content) {
      const relativePath =
        `storage/cases/${caseId}/approved_business_summary.json`;
      files.set(relativePath, serializeContent(content));
      return { relativePath };
    },
    async writeFinalBusinessPlan(caseId, markdown) {
      const relativePath = `storage/cases/${caseId}/final_business_plan.md`;
      files.set(relativePath, markdown);
      return { relativePath };
    },
    async writePrd(caseId, markdown) {
      const relativePath = `storage/cases/${caseId}/prd.md`;
      files.set(relativePath, markdown);
      return { relativePath };
    },
    async writePocSpec(caseId, markdown) {
      const relativePath = `storage/cases/${caseId}/poc_spec.md`;
      files.set(relativePath, markdown);
      return { relativePath };
    },
    async writeImplementationHandoff(caseId, content) {
      const relativePath = `storage/cases/${caseId}/implementation_handoff.json`;
      files.set(relativePath, serializeContent(content));
      return { relativePath };
    },
    async writeCodexExecutionPlan(caseId, markdown) {
      const relativePath = `storage/cases/${caseId}/codex_execution_plan.md`;
      files.set(relativePath, markdown);
      return { relativePath };
    },
  };
}

function serializeContent(content: string | unknown): string {
  return typeof content === 'string'
    ? content
    : `${JSON.stringify(content, null, 2)}\n`;
}
