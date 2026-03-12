import { describe, expect, it } from 'vitest';

import { loadPromptTemplateRegistry } from '../src/index.js';

function normalizePath(value: string): string {
  return value.replaceAll('\\', '/');
}

describe('prompt template registry traceability', () => {
  it('maps each loaded prompt template version back to source yaml files', () => {
    const registry = loadPromptTemplateRegistry();
    const judgeTemplate = registry.agents.Judge;

    expect(registry.commonFileName).toBe('common.base.yaml');
    expect(normalizePath(registry.commonFilePath)).toMatch(
      /\/docs\/agent-specs\/common\.base\.yaml$/,
    );
    expect(registry.commonSourceText).toContain('version:');

    expect(judgeTemplate.version).toBe(registry.common.version);
    expect(judgeTemplate.fileName).toBe('agent-j.judge.yaml');
    expect(normalizePath(judgeTemplate.filePath)).toMatch(
      /\/docs\/agent-specs\/agent-j\.judge\.yaml$/,
    );
    expect(judgeTemplate.versionSourceFileName).toBe(registry.commonFileName);
    expect(judgeTemplate.versionSourceFilePath).toBe(registry.commonFilePath);
    expect(judgeTemplate.sourceText).toContain('agent_name:');
    expect(judgeTemplate.sourceText).toContain('Judge');
  });
});
