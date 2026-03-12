import type {
  ApprovedBusinessSummaryArtifact,
  FactResearcherOutput,
  OpportunityStrategistOutput,
} from '@venture-advisor-os/shared-types';

import {
  composeApprovedBusinessSummary,
  type ComposeApprovedBusinessSummaryInput,
} from './approved-business-summary.js';

export interface RenderFinalBusinessPlanInput
  extends ComposeApprovedBusinessSummaryInput {
  region?: string;
  founderProfile?: string;
  preferredBusinessModels?: string[];
  constraints?: string[];
}

export function renderFinalBusinessPlan(
  input: RenderFinalBusinessPlanInput,
): string {
  const approvedSummary = composeApprovedBusinessSummary(input);
  const generatedAt = input.generatedAt ?? approvedSummary.generatedAt;
  const recommendedOpportunity =
    input.opportunityStrategy.opportunity_options[0] ?? {};
  const preferredModel =
    recommendedOpportunity.monetization ??
    input.preferredBusinessModels?.[0] ??
    input.opportunityStrategy.business_model_hypotheses[0] ??
    'Validate the best-fit monetization model during PRD.';

  return [
    '# Final Business Plan',
    '',
    renderMetadataBlock(input, approvedSummary, generatedAt),
    '## Executive Summary',
    joinParagraphs([
      `${input.topic} is a software-backed opportunity aimed at ${formatList(input.factResearch.target_user_segments)} who currently struggle with ${input.factResearch.market_problem_definition}`,
      `The recommended entry point is ${formatInlineTitle(input.opportunityStrategy.recommended_entry_point.title)} because ${fallbackText(input.opportunityStrategy.recommended_entry_point.rationale, 'it offers the strongest initial wedge based on the approved iteration.')}`,
      `The business should initially monetize through ${preferredModel.toLowerCase()} and use the approved MVP direction to prove adoption before expanding scope.`,
    ]),
    '',
    '## Market Problem Definition',
    joinParagraphs([
      input.factResearch.market_problem_definition,
      formatOptionalSentence(
        input.region,
        (region) => `Primary market lens: ${region}.`,
      ),
    ]),
    '',
    '## User Pain Points',
    renderBulletList(input.factResearch.pain_points),
    '',
    'Supporting workflow gaps:',
    renderBulletList(input.factResearch.workflow_gaps),
    '',
    '## Market Landscape',
    `Primary user segments: ${formatList(input.factResearch.target_user_segments)}.`,
    '',
    'Current alternatives:',
    renderBulletList(input.factResearch.current_alternatives),
    '',
    'Evidence highlights:',
    renderEvidenceList(input.factResearch.evidence),
    '',
    '## Competitor Analysis',
    renderCompetitorList(input.factResearch.competitors),
    '',
    '## Software Entry Opportunity',
    joinParagraphs([
      `Recommended entry point: ${formatInlineTitle(input.opportunityStrategy.recommended_entry_point.title)}.`,
      fallbackText(
        input.opportunityStrategy.recommended_entry_point.rationale,
        'The approved iteration selected this as the strongest starting wedge.',
      ),
    ]),
    '',
    'Opportunity options considered:',
    renderOpportunityList(input.opportunityStrategy.opportunity_options),
    '',
    'Initial MVP direction:',
    renderBulletList(input.opportunityStrategy.mvp_direction),
    '',
    '## Business Model Recommendation',
    joinParagraphs([
      `Recommended monetization direction: ${preferredModel}.`,
      formatOptionalSentence(
        input.preferredBusinessModels?.length
          ? formatList(input.preferredBusinessModels)
          : undefined,
        (models) => `Founder preferences to respect: ${models}.`,
      ),
    ]),
    '',
    'Business model hypotheses to validate:',
    renderBulletList(input.opportunityStrategy.business_model_hypotheses),
    '',
    'Feasibility signals:',
    renderFeasibilityList(input.opportunityStrategy.feasibility_scores),
    '',
    '## GTM Recommendation',
    joinParagraphs([
      `Start with ${formatList(input.factResearch.target_user_segments)} through direct problem-oriented positioning focused on ${formatList(input.factResearch.pain_points)}.`,
      formatOptionalSentence(
        input.founderProfile,
        (founderProfile) =>
          `Use the founder profile as a trust and distribution asset: ${founderProfile}.`,
      ),
      `Anchor launch messaging on the recommended entry point and the fastest path to demonstrating value from ${formatList(input.opportunityStrategy.mvp_direction)}.`,
    ]),
    '',
    '## Risks and Counterarguments',
    'Primary objections:',
    renderBulletList(input.vcCritic.objections),
    '',
    'Manageable risks:',
    renderBulletList(input.vcCritic.manageable_risks),
    '',
    'Open strategic questions:',
    renderBulletList(input.vcCritic.key_questions),
    '',
    'Accepted Judge concerns:',
    renderBulletList(input.judge.accepted_objections),
    '',
    '## Final Recommendation',
    joinParagraphs([
      fallbackText(
        input.vcCritic.recommendation,
        'Proceed with downstream product planning.',
      ),
      `Judge rationale: ${input.judge.rationale}`,
      `Approval basis: ${input.judge.iteration_worthiness.reason}`,
    ]),
    '',
    '## Why Now',
    joinParagraphs([
      `The evidence base scored completeness ${input.judge.evidence_assessment.completeness}/10, freshness ${input.judge.evidence_assessment.freshness}/10, and confidence ${input.judge.evidence_assessment.confidence}/10, which supports acting on the opportunity now rather than delaying discovery.`,
      `Recent market evidence and manageable objections indicate the timing is strong enough to move from validation into product definition.`,
    ]),
    '',
    '## Next Steps',
    renderNextSteps(input),
    '',
  ].join('\n');
}

function renderMetadataBlock(
  input: RenderFinalBusinessPlanInput,
  approvedSummary: ApprovedBusinessSummaryArtifact,
  generatedAt: string,
): string {
  return [
    `- Case ID: ${input.caseId}`,
    `- Topic: ${input.topic}`,
    `- Approved Iteration: ${input.approvedIterationNo}`,
    `- Generated At: ${generatedAt}`,
    `- Source Output Refs: ${approvedSummary.sourceOutputRefs.join(', ')}`,
    '',
  ].join('\n');
}

function renderEvidenceList(evidence: FactResearcherOutput['evidence']): string {
  if (evidence.length === 0) {
    return '- No evidence highlights were supplied.';
  }

  return evidence
    .map((item) => {
      const claim = fallbackText(item.claim, 'Evidence item');
      const sourceType = fallbackText(item.source_type, 'unspecified source');
      const sourceDate = fallbackText(item.source_date, 'unknown date');
      const confidence = fallbackText(item.confidence, 'unspecified confidence');

      return `- ${claim} (${sourceType}, ${sourceDate}, confidence: ${confidence})`;
    })
    .join('\n');
}

function renderCompetitorList(
  competitors: FactResearcherOutput['competitors'],
): string {
  if (competitors.length === 0) {
    return '- No direct competitors were recorded in the approved iteration.';
  }

  return competitors
    .map((competitor) => {
      const name = fallbackText(competitor.name, 'Unnamed competitor');
      const positioning = fallbackText(
        competitor.positioning,
        'positioning not captured',
      );
      const gap = fallbackText(
        competitor.weakness_or_gap,
        'gap not captured',
      );

      return `- ${name}: ${positioning}. Gap to exploit: ${gap}.`;
    })
    .join('\n');
}

function renderOpportunityList(
  opportunityOptions: OpportunityStrategistOutput['opportunity_options'],
): string {
  if (opportunityOptions.length === 0) {
    return '- No alternative opportunity options were recorded.';
  }

  return opportunityOptions
    .map((option) => {
      const title = formatInlineTitle(option.title);
      const targetUser = fallbackText(option.target_user, 'target user not captured');
      const corePain = fallbackText(option.core_pain, 'pain not captured');
      const monetization = fallbackText(
        option.monetization,
        'monetization still needs validation',
      );

      return `- ${title}: serves ${targetUser} around ${corePain}. Monetization: ${monetization}.`;
    })
    .join('\n');
}

function renderFeasibilityList(
  scores: OpportunityStrategistOutput['feasibility_scores'],
): string {
  if (scores.length === 0) {
    return '- No feasibility scores were recorded.';
  }

  return scores
    .map((score) => {
      const dimension = fallbackText(score.dimension, 'unspecified dimension');
      const value =
        typeof score.score === 'number' ? `${score.score}/10` : 'no score';
      const rationale = fallbackText(score.rationale, 'rationale not captured');

      return `- ${dimension}: ${value}. ${rationale}`;
    })
    .join('\n');
}

function renderNextSteps(input: RenderFinalBusinessPlanInput): string {
  return [
    '1. Convert the approved opportunity into a scoped PRD.',
    `2. Validate the leading assumptions: ${formatList(input.opportunityStrategy.key_assumptions)}.`,
    `3. Build the initial MVP around ${formatList(input.opportunityStrategy.mvp_direction)}.`,
    `4. Monitor the primary risks: ${formatList(input.vcCritic.manageable_risks)}.`,
    formatOptionalSentence(
      input.constraints?.length ? formatList(input.constraints) : undefined,
      (constraints) => `5. Keep execution within the stated constraints: ${constraints}.`,
    ),
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n');
}

function renderBulletList(items: readonly string[]): string {
  if (items.length === 0) {
    return '- None recorded.';
  }

  return items.map((item) => `- ${item}`).join('\n');
}

function joinParagraphs(values: Array<string | undefined>): string {
  return values.filter((value): value is string => Boolean(value)).join('\n\n');
}

function formatList(items: readonly string[]): string {
  if (items.length === 0) {
    return 'the validated target segment';
  }

  if (items.length === 1) {
    return items[0];
  }

  if (items.length === 2) {
    return `${items[0]} and ${items[1]}`;
  }

  return `${items.slice(0, -1).join(', ')}, and ${items.at(-1)}`;
}

function formatOptionalSentence<TValue>(
  value: TValue | undefined,
  formatter: (value: TValue) => string,
): string | undefined {
  return value === undefined ? undefined : formatter(value);
}

function fallbackText(value: string | undefined, fallback: string): string {
  return value && value.trim().length > 0 ? value : fallback;
}

function formatInlineTitle(value: string | undefined): string {
  return fallbackText(value, 'the selected opportunity');
}
