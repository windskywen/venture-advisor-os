import { describe, expect, it } from 'vitest';

import {
  createBrowsingAutonomySettings,
  FounderValueMeasurementSchema,
  OpportunityCaseSchema,
} from '../src/index.js';

describe('shared schemas', () => {
  it('requires rejection rationale and category for rejected cases', () => {
    const parseResult = OpportunityCaseSchema.safeParse({
      caseId: 'case-1',
      topic: 'AI bookkeeping',
      preferredBusinessModels: ['SaaS'],
      constraints: [],
      status: 'REJECTED',
      currentIteration: 2,
      maxIterations: 3,
      finalDecision: 'REJECT',
      manualReviewRequired: false,
      createdAt: '2026-03-12T10:00:00.000Z',
      updatedAt: '2026-03-12T10:30:00.000Z',
    });

    expect(parseResult.success).toBe(false);
    expect(parseResult.error?.issues.map((issue) => issue.path.join('.'))).toEqual(
      expect.arrayContaining(['rejectionRationale', 'rejectionCategory']),
    );
  });

  it('requires both approved source iteration fields when either is present', () => {
    const parseResult = OpportunityCaseSchema.safeParse({
      caseId: 'case-2',
      topic: 'AI analyst copilot',
      preferredBusinessModels: ['SaaS'],
      constraints: [],
      status: 'APPROVED_FOR_PRD',
      currentIteration: 2,
      maxIterations: 3,
      approvedSourceIterationId: 'iter-2',
      finalDecision: 'PASS',
      manualReviewRequired: false,
      createdAt: '2026-03-12T10:00:00.000Z',
      updatedAt: '2026-03-12T10:30:00.000Z',
    });

    expect(parseResult.success).toBe(false);
    expect(parseResult.error?.issues[0]?.message).toContain(
      'Approved source iteration references must include both iteration id and iteration number.',
    );
  });

  it('validates lightweight founder-value capture scores and time-saved fields', () => {
    const parseResult = FounderValueMeasurementSchema.safeParse({
      measurementId: 'measurement-1',
      caseId: 'case-1',
      respondentType: 'FOUNDER',
      actor: 'founder',
      perceivedUsefulnessScore: 6,
      confidenceIncreaseScore: 4,
      manualResearchMinutesSaved: -5,
      createdAt: '2026-03-12T10:40:00.000Z',
    });

    expect(parseResult.success).toBe(false);
    expect(parseResult.error?.issues.map((issue) => issue.path.join('.'))).toEqual(
      expect.arrayContaining([
        'perceivedUsefulnessScore',
        'manualResearchMinutesSaved',
      ]),
    );
  });

  it('derives browsing-autonomy presets and allows bounded overrides', () => {
    const browsingAutonomy = createBrowsingAutonomySettings({
      profile: 'EXPANDED',
      maxSources: 6,
    });

    expect(browsingAutonomy).toEqual({
      profile: 'EXPANDED',
      allowAdjacentExploration: true,
      allowCompetitorExploration: true,
      allowOpenEndedQueries: true,
      maxSources: 6,
      recencyWindowDays: 365,
    });
  });
});
