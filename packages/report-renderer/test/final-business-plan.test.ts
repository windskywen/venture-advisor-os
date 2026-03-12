import { describe, expect, it } from 'vitest';

import { renderFinalBusinessPlan } from '../src/index.js';

describe('final business plan renderer', () => {
  it('renders all required sections from the approved PASS iteration outputs', () => {
    const markdown = renderFinalBusinessPlan({
      caseId: 'case-123',
      topic: 'AI bookkeeping for freelancers',
      approvedIterationNo: 2,
      generatedAt: '2026-03-12T10:00:00.000Z',
      region: 'Australia',
      founderProfile: 'Founder has deep bookkeeping workflow experience.',
      preferredBusinessModels: ['Monthly SaaS subscription'],
      constraints: ['Keep onboarding under 10 minutes'],
      factResearch: {
        market_problem_definition: 'Freelancers waste time on manual bookkeeping.',
        target_user_segments: ['Solo freelancers'],
        pain_points: ['Monthly reconciliation takes too long'],
        workflow_gaps: ['No lightweight automation for mixed income streams'],
        current_alternatives: ['Spreadsheets', 'Generic accounting software'],
        competitors: [
          {
            name: 'Competitor A',
            positioning: 'General accounting suite',
            weakness_or_gap: 'Too complex for solo operators',
          },
        ],
        evidence: [
          {
            claim: 'Freelancers spend several hours per month on bookkeeping.',
            source_date: '2026-02-15',
            source_type: 'industry-report',
            confidence: 'high',
          },
        ],
        assumptions: ['Users will connect bank feeds'],
      },
      opportunityStrategy: {
        opportunity_options: [
          {
            title: 'AI bookkeeping assistant',
            product_shape: 'workflow software',
            target_user: 'Solo freelancers',
            core_pain: 'Manual categorization and reconciliation',
            monetization: 'Monthly SaaS subscription',
            pros: ['High-frequency workflow'],
            cons: ['Trust barrier on financial automation'],
          },
        ],
        recommended_entry_point: {
          title: 'AI bookkeeping assistant',
          rationale: 'It removes a recurring high-friction workflow.',
        },
        business_model_hypotheses: ['Monthly SaaS subscription'],
        mvp_direction: ['Automated categorization', 'Monthly close checklist'],
        feasibility_scores: [
          {
            dimension: 'distribution',
            score: 7,
            rationale: 'Accessible through freelancer communities.',
          },
        ],
        key_assumptions: ['Users will review AI-generated categorizations'],
      },
      vcCritic: {
        summary:
          'The opportunity is viable if trust and onboarding are handled carefully.',
        objections: ['Trust in automation', 'Competitive pressure'],
        fatal_flaws: [],
        manageable_risks: ['Need human-review workflows'],
        score_breakdown: [
          {
            dimension: 'market',
            score: 7,
            rationale: 'Freelancers have recurring pain.',
          },
        ],
        key_questions: ['How quickly can users trust automated categorizations?'],
        recommendation: 'Proceed to validation and productization.',
      },
      judge: {
        decision: 'PASS',
        rationale: 'Evidence is strong enough and objections are manageable.',
        accepted_objections: ['Trust in automation'],
        rejected_objections: [],
        evidence_assessment: {
          completeness: 8,
          freshness: 8,
          confidence: 7,
        },
        iteration_worthiness: {
          should_continue: false,
          reason: 'The opportunity is ready for downstream product planning.',
        },
        next_iteration_tasks: [],
        termination_warning: false,
      },
    });

    expect(markdown).toContain('# Final Business Plan');
    expect(markdown).toContain('## Executive Summary');
    expect(markdown).toContain('## Market Problem Definition');
    expect(markdown).toContain('## User Pain Points');
    expect(markdown).toContain('## Market Landscape');
    expect(markdown).toContain('## Competitor Analysis');
    expect(markdown).toContain('## Software Entry Opportunity');
    expect(markdown).toContain('## Business Model Recommendation');
    expect(markdown).toContain('## GTM Recommendation');
    expect(markdown).toContain('## Risks and Counterarguments');
    expect(markdown).toContain('## Final Recommendation');
    expect(markdown).toContain('## Why Now');
    expect(markdown).toContain('## Next Steps');

    expect(markdown).toContain('AI bookkeeping for freelancers');
    expect(markdown).toContain('Freelancers waste time on manual bookkeeping.');
    expect(markdown).toContain('Competitor A');
    expect(markdown).toContain('Monthly SaaS subscription');
    expect(markdown).toContain('Proceed to validation and productization.');
    expect(markdown).toContain('1. Convert the approved opportunity into a scoped PRD.');
  });

  it('rejects business plan rendering when the Judge decision is not PASS', () => {
    expect(() =>
      renderFinalBusinessPlan({
        caseId: 'case-123',
        topic: 'AI bookkeeping for freelancers',
        approvedIterationNo: 2,
        factResearch: {
          market_problem_definition: 'problem',
          target_user_segments: ['segment'],
          pain_points: ['pain'],
          workflow_gaps: ['gap'],
          current_alternatives: ['alt'],
          competitors: [],
          evidence: [],
          assumptions: [],
        },
        opportunityStrategy: {
          opportunity_options: [],
          recommended_entry_point: {},
          business_model_hypotheses: [],
          mvp_direction: [],
          feasibility_scores: [],
          key_assumptions: [],
        },
        vcCritic: {
          summary: 'summary',
          objections: [],
          fatal_flaws: [],
          manageable_risks: [],
          score_breakdown: [],
          key_questions: [],
          recommendation: 'recommendation',
        },
        judge: {
          decision: 'REVISE',
          rationale: 'Need more evidence',
          accepted_objections: [],
          rejected_objections: [],
          evidence_assessment: {
            completeness: 5,
            freshness: 5,
            confidence: 5,
          },
          iteration_worthiness: {
            should_continue: true,
            reason: 'More work is still needed.',
          },
          next_iteration_tasks: [],
          termination_warning: false,
        },
      }),
    ).toThrow('judge decision PASS');
  });
});
