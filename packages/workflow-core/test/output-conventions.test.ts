import { describe, expect, it } from 'vitest';

import { loadPromptTemplateRegistry } from '@venture-advisor-os/agent-specs';

import { validateOutputConventions } from '../src/index.js';

describe('output conventions validation', () => {
  const registry = loadPromptTemplateRegistry({
    repoRoot: process.cwd(),
  });

  it('accepts compliant FactResearcher output conventions', () => {
    const markdown = `
## Market Problem Definition
Facts: Meeting notes are still manual. [1](https://example.com/report)
Inference: The workflow is ripe for automation.
Assumptions: Teams will trust generated summaries.

## Target User Segments
Consultants

## Pain Points
Manual documentation

## Workflow Gaps
No structured note workflow

## Current Alternatives
Word docs

## Competitor Snapshot
Tool A

## Evidence List
Report [1]

## Facts vs Assumptions
Facts, inferences, and assumptions are explicitly separated.
\n`;
    const rawOutput = `\`\`\`json
{
  "market_problem_definition": "Manual notes are slow.",
  "target_user_segments": ["Consultants"],
  "pain_points": ["Manual documentation"],
  "workflow_gaps": ["No structured workflow"],
  "current_alternatives": ["Word docs"],
  "competitors": [],
  "evidence": [
    {
      "claim": "Manual notes are common.",
      "source_date": "2026-03-01",
      "source_type": "report",
      "confidence": "high"
    }
  ],
  "assumptions": ["Users trust generated summaries."]
}
\`\`\``;

    const result = validateOutputConventions({
      registry,
      agentName: 'FactResearcher',
      markdown,
      rawOutput,
    });

    expect(result).toEqual({
      valid: true,
      errors: [],
    });
  });

  it('rejects missing citations, labels, and score-range violations', () => {
    const markdown = `
## VC Summary
Evidence exists.

## Core Objections
Crowded market

## Fatal Flaws
Weak moat

## Manageable Risks
Slow GTM

## Scoring Breakdown
Out-of-range scoring

## Key Questions Before Proceeding
Can the team differentiate?

## Recommendation
Revise
\n`;

    const result = validateOutputConventions({
      registry,
      agentName: 'VCCritic',
      markdown,
      rawOutput: `{
        "summary": "Crowded market.",
        "objections": ["Crowded market"],
        "fatal_flaws": ["Weak moat"],
        "manageable_risks": ["Slow GTM"],
        "score_breakdown": [
          {
            "dimension": "Market Size",
            "score": 11,
            "rationale": "Out of range"
          }
        ],
        "key_questions": ["Can the team differentiate?"],
        "recommendation": "Revise"
      }`,
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'Citation markers are required for factual claims.',
    );
    expect(result.errors).toContain(
      'Output must explicitly distinguish facts, inferences/hypotheses, and assumptions.',
    );
    expect(result.errors).toContain(
      'Score at json.score_breakdown[0].score must be between 1 and 10.',
    );
  });

  it('rejects missing JSON summaries and malformed markdown section structure', () => {
    const result = validateOutputConventions({
      registry,
      agentName: 'Judge',
      markdown: [
        '## Decision',
        'REVISE',
        '## Accepted Objections',
        'Weak evidence',
      ].join('\n\n'),
      rawOutput: [
        '## Decision',
        'REVISE',
        '## Accepted Objections',
        'Weak evidence',
      ].join('\n\n'),
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'Missing required markdown sections: Decision Rationale, Rejected Objections, Evidence Assessment, Iteration Worthiness, Next Tasks, Termination Warning.',
    );
    expect(result.errors).toContain('No JSON summary found in raw output.');
    expect(result.errors).toContain('JSON summary is required.');
  });
});
