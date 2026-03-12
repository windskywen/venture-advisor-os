import type { PromptTemplateRegistry } from '@venture-advisor-os/agent-specs';
import type {
  BrowsingAutonomy,
  ResearchStyle,
} from '@venture-advisor-os/shared-types';
import {
  createMockAgentRuntimeAdapter,
  createResearchTool,
  type AgentRuntimeAdapter,
  type AgentRuntimeRequest,
  type ResearchTool,
} from '@venture-advisor-os/workflow-core';

const REJECT_KEYWORDS = [
  'reject',
  'bad idea',
  'not viable',
  'impossible',
  'dead end',
  'weak market',
];
const PIVOT_KEYWORDS = ['pivot', 'switch', 'alternative wedge', 'new angle'];
const REVISE_KEYWORDS = ['revise', 'improve', 'iterate', 'complex', 'regulatory'];

export function createDeterministicResearchTool(): ResearchTool {
  return createResearchTool((query) => {
    const topic = query.topic.trim();
    const segment = inferPrimarySegment(topic);
    const productShape = inferProductShape(topic);
    const retrievedAt = query.requestedAt;
    const publishedAt = resolvePublishedAt(retrievedAt);
    const styleLabel = describeResearchStyle(query.researchStyle);
    const browsingSummary = describeBrowsingAutonomy(query.browsingAutonomy);

    return {
      query,
      findings: [
        {
          claim: `${segment} still rely on fragmented manual workflows around ${topic.toLowerCase()}.`,
          facts: [
            `${segment} spend time stitching tools together instead of using a single ${productShape}.`,
            `${styleLabel} research still surfaces repeatable workflow pain in ${query.region ?? 'their target region'}.`,
          ],
          sources: [
            createSourceRecord({
              title: `${segment} workflow benchmark`,
              snippet: `${segment} continue to report manual hand-offs and poor traceability.`,
              url: 'https://example.com/workflow-benchmark',
              publishedAt,
              retrievedAt,
              sourceType: 'report',
            }),
            createSourceRecord({
              title: `${topic} market activity snapshot`,
              snippet: browsingSummary,
              url: 'https://example.com/market-activity',
              publishedAt,
              retrievedAt,
              sourceType: 'article',
            }),
          ],
        },
        {
          claim: `Existing alternatives for ${topic.toLowerCase()} still leave whitespace for a focused entrant.`,
          facts: [
            'Buyers can usually adopt a narrower first wedge more easily than a full platform replacement.',
            'Competitor messaging tends to stay broad, which creates room for a workflow-specific product.',
          ],
          sources: [
            createSourceRecord({
              title: 'Alternative tooling comparison',
              snippet: 'Most alternatives stay horizontal and lightly opinionated.',
              url: 'https://example.com/tooling-comparison',
              publishedAt,
              retrievedAt,
              sourceType: 'report',
            }),
          ],
        },
      ],
    };
  });
}

export function createDeterministicAgentRuntime(
  registry: PromptTemplateRegistry,
): AgentRuntimeAdapter {
  return createMockAgentRuntimeAdapter((request) => ({
    agentName: request.agentName,
    rawOutput: renderCompliantAgentOutput(
      registry,
      request.agentName,
      buildDeterministicSummary(request),
    ),
    metadata: {
      backend: 'deterministic-local-runtime',
      latencyMs: 50,
      tokenUsage: {
        inputTokens: 256,
        outputTokens: 384,
        totalTokens: 640,
      },
    },
  }));
}

function buildDeterministicSummary(
  request: AgentRuntimeRequest,
): Record<string, unknown> {
  switch (request.agentName) {
    case 'FactResearcher':
      return buildFactResearcherSummary(request.inputPayload);
    case 'OpportunityStrategist':
      return buildOpportunityStrategistSummary(request.inputPayload);
    case 'VCCritic':
      return buildVcCriticSummary(request.inputPayload);
    case 'Judge':
      return buildJudgeSummary(request.inputPayload);
    case 'PRDStrategist':
      return buildPrdSummary(request.inputPayload);
    case 'POCArchitect':
      return buildPocSummary(request.inputPayload);
  }
}

function buildFactResearcherSummary(
  inputPayload: Record<string, unknown>,
): Record<string, unknown> {
  const topic = readString(inputPayload, 'topic', 'AI workflow tool');
  const segment = inferPrimarySegment(topic);
  const competitor = inferCompetitorName(topic);
  const evidenceDate = resolvePublishedAt(new Date().toISOString()).slice(0, 10);

  return {
    market_problem_definition: `${segment} still lose time to fragmented ${topic.toLowerCase()} workflows.`,
    target_user_segments: [segment, `Lean ${segment.toLowerCase()} teams`],
    pain_points: [
      'Manual hand-offs slow execution.',
      'Decision context is scattered across too many tools.',
    ],
    workflow_gaps: [
      `No opinionated ${topic.toLowerCase()} workflow exists for the first 15 minutes of work.`,
      'Teams lack a shared source of truth for prioritization and follow-up.',
    ],
    current_alternatives: [
      'Spreadsheets',
      'Notion templates',
      'Generic project management software',
    ],
    competitors: [
      {
        name: competitor,
        positioning: `Horizontal ${inferProductShape(topic)} for many teams`,
        weakness_or_gap: `Weak specialization for ${segment.toLowerCase()} workflows`,
      },
      {
        name: 'Manual in-house process',
        positioning: 'Custom internal process',
        weakness_or_gap: 'Hard to scale and hard to audit',
      },
    ],
    evidence: [
      {
        claim: `${segment} still report workflow fragmentation and duplicated effort.`,
        source_date: evidenceDate,
        source_type: 'report',
        confidence: 'high',
      },
      {
        claim: `Buyers evaluate focused automation before broad platform replacement for ${topic.toLowerCase()}.`,
        source_date: evidenceDate,
        source_type: 'article',
        confidence: 'medium',
      },
    ],
    assumptions: [
      `${segment} will trial a focused entry wedge if activation is fast.`,
      'A narrow initial workflow can expand into a broader system of record later.',
    ],
  };
}

function buildOpportunityStrategistSummary(
  inputPayload: Record<string, unknown>,
): Record<string, unknown> {
  const topic = readString(inputPayload, 'topic', 'AI workflow tool');
  const segment = inferPrimarySegment(topic);
  const productShape = inferProductShape(topic);
  const entryTitle = buildEntryPointTitle(topic);

  return {
    opportunity_options: [
      {
        title: entryTitle,
        product_shape: productShape,
        target_user: segment,
        core_pain: `Too much manual coordination around ${topic.toLowerCase()}.`,
        monetization: 'subscription',
        pros: [
          'High-frequency workflow',
          'Clear before/after value proposition',
        ],
        cons: ['Crowded tooling landscape', 'Requires strong onboarding'],
      },
      {
        title: `${segment} collaboration workspace`,
        product_shape: 'workspace',
        target_user: `${segment} leaders`,
        core_pain: 'Lack of a single operational view',
        monetization: 'seat-based SaaS',
        pros: ['Broader upsell path'],
        cons: ['Longer time to value'],
      },
    ],
    recommended_entry_point: {
      title: entryTitle,
      rationale: `A focused ${productShape} for ${segment.toLowerCase()} gives the clearest activation path.`,
    },
    business_model_hypotheses: [
      'Per-seat subscription for core workflow automation',
      'Premium tier for analytics and approvals',
    ],
    mvp_direction: [
      'Capture the first high-friction workflow',
      'Summarize next actions automatically',
      'Provide an operator-ready review queue',
    ],
    feasibility_scores: [
      {
        dimension: 'Technical',
        score: 8,
        rationale: 'The workflow can be composed from established app patterns.',
      },
      {
        dimension: 'Go-to-market',
        score: 7,
        rationale: 'A narrow wedge supports clear outbound and community messaging.',
      },
    ],
    key_assumptions: [
      `${segment} will trust guided automation if review points are explicit.`,
      'The first workflow is painful enough to support near-term willingness to pay.',
    ],
  };
}

function buildVcCriticSummary(
  inputPayload: Record<string, unknown>,
): Record<string, unknown> {
  const topic = readString(inputPayload, 'topic', 'AI workflow tool');
  const decision = resolveScenarioDecision(
    topic,
    readNumber(inputPayload, 'iteration_no', 1),
    readNumber(inputPayload, 'max_iterations', 3),
  );
  const baseScore =
    decision === 'REJECT' ? 4.8 : decision === 'PASS' ? 8.1 : 6.6;

  return {
    summary:
      decision === 'PASS'
        ? 'The opportunity looks fundable if the team stays focused on a narrow wedge.'
        : decision === 'REJECT'
          ? 'The business case is too weak to justify more work.'
          : 'The opportunity is directionally interesting but needs another focused loop.',
    objections:
      decision === 'PASS'
        ? ['Crowded market']
        : ['Need sharper wedge selection', 'Need stronger evidence of urgency'],
    fatal_flaws:
      decision === 'REJECT'
        ? ['Weak signal that the problem is acute enough to support a company']
        : [],
    manageable_risks: [
      'Distribution remains unproven',
      'Messaging must stay specific to avoid looking generic',
    ],
    score_breakdown: [
      {
        dimension: 'Market Attractiveness',
        score: roundScore(baseScore),
        rationale: 'The workflow is common enough to matter if the wedge is tight.',
      },
      {
        dimension: 'Execution Feasibility',
        score: roundScore(baseScore - 0.2),
        rationale: 'The initial product can be built quickly with standard product patterns.',
      },
      {
        dimension: 'Monetization',
        score: roundScore(baseScore - 0.4),
        rationale: 'Conversion depends on proving recurring value inside one strong use case.',
      },
    ],
    key_questions: [
      'Can the team win a narrow segment quickly?',
      'Is there a clear reason buyers switch from their current process?',
    ],
    recommendation:
      decision === 'REJECT'
        ? 'Do not continue'
        : decision === 'PASS'
          ? 'Proceed'
          : 'Continue with a narrower iteration',
  };
}

function buildJudgeSummary(
  inputPayload: Record<string, unknown>,
): Record<string, unknown> {
  const topic = readString(inputPayload, 'topic', 'AI workflow tool');
  const iterationNo = readNumber(inputPayload, 'iteration_no', 1);
  const maxIterations = readNumber(inputPayload, 'max_iterations', 3);
  const decision = resolveScenarioDecision(topic, iterationNo, maxIterations);
  const acceptedObjections = readStringArrayFromRecord(
    inputPayload,
    'vc_critic_summary',
    'objections',
  );

  if (decision === 'PASS') {
    return {
      decision: 'PASS',
      rationale:
        'The wedge is focused enough, the evidence is recent enough, and the risk profile is manageable.',
      accepted_objections: acceptedObjections.slice(0, 1),
      rejected_objections: acceptedObjections.slice(1),
      evidence_assessment: {
        completeness: 8,
        freshness: 8,
        confidence: 8,
      },
      iteration_worthiness: {
        should_continue: false,
        reason: 'Additional loops are not required before downstream planning.',
      },
      next_iteration_tasks: [],
      termination_warning: false,
    };
  }

  if (decision === 'PIVOT') {
    return {
      decision: 'PIVOT',
      rationale:
        'The market problem still matters, but the current entry angle is not sharp enough.',
      accepted_objections: acceptedObjections,
      rejected_objections: [],
      evidence_assessment: {
        completeness: 7,
        freshness: 7,
        confidence: 7,
      },
      iteration_worthiness: {
        should_continue: true,
        reason: 'A focused pivot can materially improve the business case.',
      },
      next_iteration_tasks: [
        {
          target_agent: 'OPPORTUNITY_STRATEGIST',
          task_type: 'STRATEGY_REFRAME',
          description: 'Reframe the entry point around the highest-urgency workflow.',
          blocking: true,
        },
      ],
      termination_warning: iterationNo + 1 >= maxIterations,
    };
  }

  if (decision === 'REVISE') {
    return {
      decision: 'REVISE',
      rationale:
        'The concept is promising, but the evidence and MVP scope still need another targeted pass.',
      accepted_objections: acceptedObjections,
      rejected_objections: [],
      evidence_assessment: {
        completeness: 6,
        freshness: 6,
        confidence: 6,
      },
      iteration_worthiness: {
        should_continue: true,
        reason: 'There is still a clear path to improve the case with targeted work.',
      },
      next_iteration_tasks: [
        {
          target_agent: 'FACT_RESEARCHER',
          task_type: 'EVIDENCE_REFRESH',
          description: 'Refresh the latest market and buyer evidence for the wedge.',
          blocking: true,
        },
        {
          target_agent: 'OPPORTUNITY_STRATEGIST',
          task_type: 'MVP_RESCOPING',
          description: 'Narrow the MVP to one concrete workflow and one buyer trigger.',
          blocking: true,
        },
      ],
      termination_warning: iterationNo + 1 >= maxIterations,
    };
  }

  return {
    decision: 'REJECT',
    rationale:
      'The opportunity still lacks enough evidence and differentiation to justify another loop.',
    accepted_objections: acceptedObjections,
    rejected_objections: [],
    evidence_assessment: {
      completeness: 4,
      freshness: 5,
      confidence: 4,
    },
    iteration_worthiness: {
      should_continue: false,
      reason: 'The iteration budget should be preserved for stronger topics.',
    },
    next_iteration_tasks: [],
    termination_warning: true,
  };
}

function buildPrdSummary(
  inputPayload: Record<string, unknown>,
): Record<string, unknown> {
  const topic = readString(inputPayload, 'topic', 'AI workflow tool');
  const segment = inferPrimarySegment(topic);
  const entryTitle = buildEntryPointTitle(topic);

  return {
    product_overview: `${entryTitle} is a focused product for ${segment.toLowerCase()} that reduces manual workflow drag.`,
    problem_statement: `${segment} need a faster and more opinionated way to manage ${topic.toLowerCase()} without relying on fragmented tools.`,
    target_users: [segment, `${segment} team leads`],
    use_cases: [
      'Capture workflow inputs quickly',
      'Generate structured next steps',
      'Route decisions for operator review',
    ],
    functional_requirements: [
      'Create and track workflow items',
      'Generate AI-assisted summaries and recommendations',
      'Store operator decisions with auditability',
    ],
    non_functional_requirements: [
      'Fast first-run experience',
      'Clear operator visibility',
      'Exportable decision history',
    ],
    mvp_scope: [
      'Single workflow entry point',
      'Single-team collaboration',
      'Basic dashboard and decision feed',
    ],
    out_of_scope: [
      'Full platform replacement',
      'Multi-region compliance orchestration',
    ],
    user_stories: [
      'As an operator, I want AI-assisted summaries so I can review faster.',
      'As a lead, I want a clear decision queue so I can unblock the team.',
    ],
    success_metrics: [
      'Activation within one session',
      'Time saved per workflow item',
      'Weekly retained teams',
    ],
    risks: [
      'Generic positioning could slow adoption',
      'Poor onboarding could hide the product value',
    ],
    open_questions: [
      'Which acquisition channel reaches the first 20 teams fastest?',
      'What review controls do buyers expect before trusting automation?',
    ],
  };
}

function buildPocSummary(
  inputPayload: Record<string, unknown>,
): Record<string, unknown> {
  const topic = readString(inputPayload, 'topic', 'AI workflow tool');

  return {
    poc_goal: `Demonstrate a credible first workflow for ${topic.toLowerCase()} from input to operator decision.`,
    validation_hypotheses: [
      'Teams value the workflow enough to replace part of their manual process.',
      'AI-generated summaries shorten review time without losing control.',
    ],
    demo_scope: [
      'Single workflow intake form',
      'AI summary generation',
      'Operator review queue and status tracking',
    ],
    technical_architecture: [
      'HTTP API for workflow operations',
      'PostgreSQL persistence for cases and iterations',
      'Background worker for orchestration and artifact generation',
    ],
    core_modules: [
      'Case intake',
      'Workflow orchestration',
      'Artifact renderer',
      'Operator dashboard placeholder',
    ],
    data_inputs: [
      'Topic or workflow description',
      'Operator review decisions',
      'Generated case artifacts',
    ],
    mock_vs_real: [
      'Use deterministic local agent outputs for POC speed',
      'Keep storage and queue infrastructure real',
    ],
    acceptance_criteria: [
      'A case can progress from intake to completed handoff',
      'Artifacts are written to persistent storage',
      'Telegram control flow can trigger the case lifecycle',
    ],
    build_tasks: [
      'Wire the queue-driven worker',
      'Render downstream artifacts',
      'Expose operator-friendly status endpoints',
    ],
    risks_and_fallback: [
      'Deterministic outputs are not real market research',
      'Fallback is manual operator review and approval overrides',
    ],
  };
}

function createSourceRecord(input: {
  title: string;
  snippet: string;
  url: string;
  publishedAt: string;
  retrievedAt: string;
  sourceType: 'article' | 'report';
}) {
  return {
    title: input.title,
    snippet: input.snippet,
    sourceType: input.sourceType,
    citation: {
      label: `[${input.sourceType}]`,
      url: input.url,
      publishedAt: input.publishedAt,
      retrievedAt: input.retrievedAt,
    },
  };
}

function renderCompliantAgentOutput(
  registry: PromptTemplateRegistry,
  agentName: string,
  jsonSummary: unknown,
): string {
  const template = registry.agents[agentName];
  if (!template) {
    throw new Error(`Unknown prompt template agent: ${agentName}`);
  }

  const markdown = template.requiredSections
    .map((section, index) => {
      const lines =
        index === 0
          ? [
              'Facts: The local runtime generated a deterministic but schema-valid section. [1](https://example.com/source)',
              'Inference: The workflow can continue with a concrete next step.',
              'Assumptions: The operating context remains directionally stable.',
            ]
          : ['Supporting analysis for this required section.'];

      return `## ${section}\n${lines.join('\n')}`;
    })
    .join('\n\n');

  return `${markdown}\n\n\`\`\`json\n${JSON.stringify(jsonSummary, null, 2)}\n\`\`\``;
}

function readString(
  payload: Record<string, unknown>,
  key: string,
  fallback: string,
): string {
  const value = payload[key];
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : fallback;
}

function readNumber(
  payload: Record<string, unknown>,
  key: string,
  fallback: number,
): number {
  const value = payload[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function readStringArrayFromRecord(
  payload: Record<string, unknown>,
  key: string,
  nestedKey: string,
): string[] {
  const nested = payload[key];
  if (!nested || typeof nested !== 'object') {
    return [];
  }

  const value = (nested as Record<string, unknown>)[nestedKey];
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === 'string');
}

function resolveScenarioDecision(
  topic: string,
  iterationNo: number,
  maxIterations: number,
): 'PASS' | 'REVISE' | 'PIVOT' | 'REJECT' {
  const normalizedTopic = topic.toLowerCase();

  if (containsAny(normalizedTopic, REJECT_KEYWORDS)) {
    return 'REJECT';
  }

  if (containsAny(normalizedTopic, PIVOT_KEYWORDS) && iterationNo < maxIterations) {
    return iterationNo === 1 ? 'PIVOT' : 'PASS';
  }

  if (containsAny(normalizedTopic, REVISE_KEYWORDS) && iterationNo < maxIterations) {
    return iterationNo === 1 ? 'REVISE' : 'PASS';
  }

  return 'PASS';
}

function containsAny(value: string, keywords: readonly string[]): boolean {
  return keywords.some((keyword) => value.includes(keyword));
}

function inferPrimarySegment(topic: string): string {
  const normalizedTopic = topic.toLowerCase();
  const segmentMap: Array<[string, string]> = [
    ['freelancer', 'Freelancers'],
    ['consultant', 'Consultants'],
    ['analyst', 'Analysts'],
    ['finance', 'Finance teams'],
    ['sales', 'Sales teams'],
    ['recruit', 'Recruiting teams'],
    ['founder', 'Founders'],
    ['operator', 'Operators'],
  ];

  for (const [keyword, segment] of segmentMap) {
    if (normalizedTopic.includes(keyword)) {
      return segment;
    }
  }

  return 'SMB operators';
}

function inferProductShape(topic: string): string {
  const normalizedTopic = topic.toLowerCase();

  if (normalizedTopic.includes('marketplace')) {
    return 'marketplace';
  }

  if (normalizedTopic.includes('dashboard') || normalizedTopic.includes('workspace')) {
    return 'workspace';
  }

  if (normalizedTopic.includes('assistant') || normalizedTopic.includes('copilot')) {
    return 'copilot';
  }

  return 'workflow SaaS';
}

function inferCompetitorName(topic: string): string {
  const normalizedTopic = topic.toLowerCase();

  if (normalizedTopic.includes('crm')) {
    return 'HubSpot';
  }

  if (normalizedTopic.includes('project')) {
    return 'Asana';
  }

  if (normalizedTopic.includes('finance') || normalizedTopic.includes('bookkeeping')) {
    return 'QuickBooks';
  }

  return 'Notion';
}

function buildEntryPointTitle(topic: string): string {
  const cleaned = topic
    .split(/\s+/u)
    .slice(0, 4)
    .join(' ')
    .trim();

  return cleaned.length > 0 ? cleaned : 'Focused workflow copilot';
}

function resolvePublishedAt(retrievedAt: string): string {
  const retrieved = new Date(retrievedAt);
  if (Number.isNaN(retrieved.getTime())) {
    return '2026-03-01T00:00:00.000Z';
  }

  retrieved.setUTCDate(retrieved.getUTCDate() - 14);
  return retrieved.toISOString();
}

function describeResearchStyle(
  researchStyle: ResearchStyle | undefined,
): string {
  switch (researchStyle) {
    case 'CUSTOMER_WORKFLOW':
      return 'Customer-workflow-focused';
    case 'COMPETITOR_INTENSIVE':
      return 'Competitor-intensive';
    case 'REGULATORY_RISK':
      return 'Regulatory-risk';
    case 'MARKET_TIMING':
      return 'Market-timing';
    default:
      return 'Balanced';
  }
}

function describeBrowsingAutonomy(
  browsingAutonomy: BrowsingAutonomy | undefined,
): string {
  if (!browsingAutonomy) {
    return 'Standard bounded exploration over a small source set.';
  }

  return `${browsingAutonomy.profile} browsing with max ${browsingAutonomy.maxSources} sources and ${browsingAutonomy.recencyWindowDays}-day recency window.`;
}

function roundScore(value: number): number {
  return Math.max(1, Math.min(10, Math.round(value * 10) / 10));
}
