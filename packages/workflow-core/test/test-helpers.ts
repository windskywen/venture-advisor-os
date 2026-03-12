import type { PromptTemplateRegistry } from '@venture-advisor-os/agent-specs';

export function renderCompliantAgentOutput(
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
              'Facts: Evidence from the latest analysis supports this section. [1](https://example.com/source)',
              'Inference: This supports a focused next step for the opportunity.',
              'Assumptions: The target user behavior remains directionally stable.',
            ]
          : ['Supporting analysis for this required section.'];

      return `## ${section}\n${lines.join('\n')}`;
    })
    .join('\n\n');

  return `${markdown}\n\n\`\`\`json\n${JSON.stringify(jsonSummary, null, 2)}\n\`\`\``;
}
