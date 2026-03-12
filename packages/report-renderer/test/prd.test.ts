import { describe, expect, it } from 'vitest';

import { renderPrd } from '../src/index.js';

describe('PRD renderer', () => {
  it('renders all required PRD sections including non-functional requirements, risks, and open questions', () => {
    const markdown = renderPrd({
      caseId: 'case-123',
      topic: 'AI bookkeeping for freelancers',
      approvedIterationNo: 2,
      generatedAt: '2026-03-12T11:00:00.000Z',
      prd: {
        product_overview:
          'An AI bookkeeping assistant for solo freelancers and small agencies.',
        problem_statement:
          'Manual bookkeeping and month-end close work remain slow and error-prone.',
        target_users: ['Solo freelancers', 'Small agencies'],
        use_cases: ['Review categorized transactions', 'Prepare month-end close'],
        functional_requirements: [
          'Connect financial accounts securely',
          'Draft AI-based transaction categorizations',
        ],
        non_functional_requirements: [
          'Return dashboard data in under 2 seconds',
          'Retain audit logs for every AI-suggested categorization',
        ],
        mvp_scope: ['Transaction categorization', 'Month-end close checklist'],
        out_of_scope: ['Payroll', 'Full-service tax filing'],
        user_stories: [
          'As a freelancer, I want AI suggestions so I can close my books faster.',
        ],
        success_metrics: [
          'Reduce month-end close time by 50%',
          'Reach 80% weekly active usage among onboarded users',
        ],
        risks: ['Users may distrust automated categorizations'],
        open_questions: ['Should accountant collaboration be in MVP or phase 2?'],
      },
    });

    expect(markdown).toContain('# Product Requirements Document');
    expect(markdown).toContain('## Product Overview');
    expect(markdown).toContain('## Problem Statement');
    expect(markdown).toContain('## Target Users');
    expect(markdown).toContain('## Use Cases');
    expect(markdown).toContain('## Functional Requirements');
    expect(markdown).toContain('## Non-Functional Requirements');
    expect(markdown).toContain('## MVP Scope');
    expect(markdown).toContain('## Out of Scope');
    expect(markdown).toContain('## User Stories');
    expect(markdown).toContain('## Success Metrics');
    expect(markdown).toContain('## Risks');
    expect(markdown).toContain('## Open Questions');

    expect(markdown).toContain('AI bookkeeping for freelancers');
    expect(markdown).toContain('Connect financial accounts securely');
    expect(markdown).toContain('Return dashboard data in under 2 seconds');
    expect(markdown).toContain('Users may distrust automated categorizations');
    expect(markdown).toContain(
      'Should accountant collaboration be in MVP or phase 2?',
    );
  });
});
