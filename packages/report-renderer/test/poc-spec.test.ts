import { describe, expect, it } from 'vitest';

import { renderPocSpec } from '../src/index.js';

describe('POC spec renderer', () => {
  it('renders all required POC sections including mock-vs-real decisions and fallback planning', () => {
    const markdown = renderPocSpec({
      caseId: 'case-123',
      topic: 'AI bookkeeping for freelancers',
      approvedIterationNo: 2,
      generatedAt: '2026-03-12T12:00:00.000Z',
      poc: {
        poc_goal:
          'Validate that freelancers trust AI-assisted bookkeeping suggestions.',
        validation_hypotheses: [
          'Users will review AI-suggested categorizations instead of editing from scratch',
        ],
        demo_scope: ['Upload transactions', 'Review categorization suggestions'],
        technical_architecture: [
          'Web UI',
          'API service',
          'Rules engine with LLM-assisted categorization',
        ],
        core_modules: ['Ingestion', 'Categorization review', 'Audit trail'],
        data_inputs: ['CSV transaction export', 'Mock chart of accounts'],
        mock_vs_real: [
          'Real CSV uploads',
          'Mock bank feed sync until reliability is proven',
        ],
        acceptance_criteria: [
          'Users complete a review workflow in under 10 minutes',
        ],
        build_tasks: ['Build CSV upload flow', 'Build categorization review screen'],
        risks_and_fallback: [
          'If categorization accuracy is too low, fall back to rule-based suggestions plus manual confirmation',
        ],
      },
    });

    expect(markdown).toContain('# POC Specification');
    expect(markdown).toContain('## POC Goal');
    expect(markdown).toContain('## Validation Hypotheses');
    expect(markdown).toContain('## Demo Scope');
    expect(markdown).toContain('## Technical Architecture');
    expect(markdown).toContain('## Core Modules');
    expect(markdown).toContain('## Data Inputs');
    expect(markdown).toContain('## Mock vs Real Components');
    expect(markdown).toContain('## Acceptance Criteria');
    expect(markdown).toContain('## Build Tasks');
    expect(markdown).toContain('## Risks and Fallback Plan');

    expect(markdown).toContain('AI bookkeeping for freelancers');
    expect(markdown).toContain('Real CSV uploads');
    expect(markdown).toContain(
      'If categorization accuracy is too low, fall back to rule-based suggestions plus manual confirmation',
    );
  });
});
