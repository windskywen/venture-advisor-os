import type { PocArchitectOutput } from '@venture-advisor-os/shared-types';

export interface RenderPocSpecInput {
  caseId: string;
  topic: string;
  approvedIterationNo: number;
  poc: PocArchitectOutput;
  generatedAt?: string;
}

export function renderPocSpec(input: RenderPocSpecInput): string {
  const generatedAt = input.generatedAt ?? new Date().toISOString();

  return [
    '# POC Specification',
    '',
    `- Case ID: ${input.caseId}`,
    `- Topic: ${input.topic}`,
    `- Approved Iteration: ${input.approvedIterationNo}`,
    `- Generated At: ${generatedAt}`,
    '',
    '## POC Goal',
    input.poc.poc_goal,
    '',
    '## Validation Hypotheses',
    renderBulletList(input.poc.validation_hypotheses),
    '',
    '## Demo Scope',
    renderBulletList(input.poc.demo_scope),
    '',
    '## Technical Architecture',
    renderBulletList(input.poc.technical_architecture),
    '',
    '## Core Modules',
    renderBulletList(input.poc.core_modules),
    '',
    '## Data Inputs',
    renderBulletList(input.poc.data_inputs),
    '',
    '## Mock vs Real Components',
    renderBulletList(input.poc.mock_vs_real),
    '',
    '## Acceptance Criteria',
    renderBulletList(input.poc.acceptance_criteria),
    '',
    '## Build Tasks',
    renderBulletList(input.poc.build_tasks),
    '',
    '## Risks and Fallback Plan',
    renderBulletList(input.poc.risks_and_fallback),
    '',
  ].join('\n');
}

function renderBulletList(items: readonly string[]): string {
  if (items.length === 0) {
    return '- None recorded.';
  }

  return items.map((item) => `- ${item}`).join('\n');
}
