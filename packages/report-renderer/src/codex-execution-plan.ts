import type { ImplementationHandoffArtifact } from '@venture-advisor-os/shared-types';

export function renderCodexExecutionPlan(
  handoff: ImplementationHandoffArtifact,
): string {
  return [
    '# Codex Execution Plan',
    '',
    '## Build Context',
    `- Case: ${handoff.caseId}`,
    `- Topic: ${handoff.implementationBrief.topic}`,
    `- Entry point: ${handoff.implementationBrief.recommendedEntryPoint}`,
    '',
    '## Bootstrap Tasks',
    ...handoff.codexExecutionPlan.bootstrapTasks.map((task) => `- ${task}`),
    '',
    '## Validation Checklist',
    ...handoff.codexExecutionPlan.validationChecklist.map(
      (item) => `- ${item}`,
    ),
    '',
    '## Starter Prompt',
    handoff.codexExecutionPlan.starterPrompt,
    '',
    '## Artifact Refs',
    `- Approved summary: ${handoff.artifactRefs.approvedBusinessSummary}`,
    `- Final business plan: ${handoff.artifactRefs.finalBusinessPlan}`,
    `- PRD: ${handoff.artifactRefs.prd}`,
    `- POC spec: ${handoff.artifactRefs.pocSpec}`,
  ].join('\n');
}
