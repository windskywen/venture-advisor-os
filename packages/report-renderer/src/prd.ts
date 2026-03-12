import type { PrdStrategistOutput } from '@venture-advisor-os/shared-types';

export interface RenderPrdInput {
  caseId: string;
  topic: string;
  approvedIterationNo: number;
  prd: PrdStrategistOutput;
  generatedAt?: string;
}

export function renderPrd(input: RenderPrdInput): string {
  const generatedAt = input.generatedAt ?? new Date().toISOString();

  return [
    '# Product Requirements Document',
    '',
    `- Case ID: ${input.caseId}`,
    `- Topic: ${input.topic}`,
    `- Approved Iteration: ${input.approvedIterationNo}`,
    `- Generated At: ${generatedAt}`,
    '',
    '## Product Overview',
    `${input.prd.product_overview}`,
    '',
    `This PRD stays aligned to the approved opportunity for ${input.topic}.`,
    '',
    '## Problem Statement',
    input.prd.problem_statement,
    '',
    '## Target Users',
    renderBulletList(input.prd.target_users),
    '',
    '## Use Cases',
    renderBulletList(input.prd.use_cases),
    '',
    '## Functional Requirements',
    renderBulletList(input.prd.functional_requirements),
    '',
    '## Non-Functional Requirements',
    renderBulletList(input.prd.non_functional_requirements),
    '',
    '## MVP Scope',
    renderBulletList(input.prd.mvp_scope),
    '',
    '## Out of Scope',
    renderBulletList(input.prd.out_of_scope),
    '',
    '## User Stories',
    renderBulletList(input.prd.user_stories),
    '',
    '## Success Metrics',
    renderBulletList(input.prd.success_metrics),
    '',
    '## Risks',
    renderBulletList(input.prd.risks),
    '',
    '## Open Questions',
    renderBulletList(input.prd.open_questions),
    '',
  ].join('\n');
}

function renderBulletList(items: readonly string[]): string {
  if (items.length === 0) {
    return '- None recorded.';
  }

  return items.map((item) => `- ${item}`).join('\n');
}
