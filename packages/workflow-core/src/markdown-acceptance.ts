import type { PromptTemplateRegistry } from '@venture-advisor-os/agent-specs';

export function assertRequiredMarkdownSections(
  registry: PromptTemplateRegistry,
  agentName: string,
  rawOutput: string,
): void {
  const template = registry.agents[agentName];
  if (!template) {
    throw new Error(`Unknown prompt template agent: ${agentName}`);
  }

  const markdown = extractMarkdownPortion(rawOutput);
  const result = template.requiredMarkdownSectionsSchema.safeParse(markdown);
  if (result.success) {
    return;
  }

  throw new Error(result.error.issues[0]?.message ?? 'Invalid markdown output.');
}

export function extractMarkdownPortion(rawOutput: string): string {
  const jsonFenceIndex = rawOutput.indexOf('```json');
  if (jsonFenceIndex === -1) {
    return rawOutput;
  }

  return rawOutput.slice(0, jsonFenceIndex).trim();
}
