import { describe, expect, it } from 'vitest';

import {
  createRequiredMarkdownSectionsSchema,
  loadPromptTemplateRegistry,
  validateRequiredMarkdownSections,
} from '../src/index.js';

describe('required markdown section validation', () => {
  it('extracts required sections from the prompt registry and validates markdown', () => {
    const registry = loadPromptTemplateRegistry();
    const factResearcherSpec = registry.agents.FactResearcher;

    const markdown = [
      '# Market Problem Definition',
      'Problem detail.',
      '## Target User Segments',
      'Segment detail.',
      '## Pain Points',
      'Pain detail.',
      '## Workflow Gaps',
      'Gap detail.',
      '## Current Alternatives',
      'Alternatives detail.',
      '## Competitor Snapshot',
      'Competition detail.',
      '## Evidence List',
      'Evidence detail.',
    ].join('\n\n');

    const result = validateRequiredMarkdownSections(
      markdown,
      factResearcherSpec.requiredSections,
    );

    expect(result.missingSections).toEqual(['Facts vs Assumptions']);
  });

  it('fails schema validation when a required markdown section is missing', () => {
    const schema = createRequiredMarkdownSectionsSchema([
      'Decision',
      'Decision Rationale',
    ]);

    const parseResult = schema.safeParse(
      ['# Decision', 'A routing choice.'].join('\n\n'),
    );

    expect(parseResult.success).toBe(false);
    expect(parseResult.error?.issues[0]?.message).toContain(
      'Decision Rationale',
    );
  });

  it('accepts markdown when all required sections are present', () => {
    const registry = loadPromptTemplateRegistry();
    const judgeSpec = registry.agents.Judge;

    const markdown = [
      '# Decision',
      'PASS',
      '## Decision Rationale',
      'Clear rationale.',
      '## Accepted Objections',
      'None.',
      '## Rejected Objections',
      'None.',
      '## Evidence Assessment',
      'Sufficient evidence.',
      '## Iteration Worthiness',
      'No further loops required.',
      '## Next Tasks',
      'No tasks.',
      '## Termination Warning',
      'False.',
    ].join('\n\n');

    const parseResult =
      judgeSpec.requiredMarkdownSectionsSchema.safeParse(markdown);

    expect(parseResult.success).toBe(true);
  });
});
