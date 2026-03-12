import { describe, expect, it } from 'vitest';

import { createScoreSummaryService } from '../src/index.js';

describe('score summary service', () => {
  it('persists routing summary scores and reconstructs them for reporting', async () => {
    const insertedScores: Array<Record<string, unknown>> = [];
    const service = createScoreSummaryService({
      scoreDetails: {
        async insertMany(scoreDetails) {
          insertedScores.push(...scoreDetails);
          return [...scoreDetails];
        },
        async listByIterationId() {
          return insertedScores.map((scoreDetail) => ({
            ...scoreDetail,
            scoreDetailId: String(scoreDetail.scoreDetailId),
            caseId: String(scoreDetail.caseId),
            iterationId: String(scoreDetail.iterationId),
            iterationNo: Number(scoreDetail.iterationNo),
            scoringAgent: scoreDetail.scoringAgent as 'VCCritic' | 'Judge',
            dimension: String(scoreDetail.dimension),
            score: Number(scoreDetail.score),
            rationale:
              scoreDetail.rationale === undefined
                ? undefined
                : String(scoreDetail.rationale),
          }));
        },
      },
    });

    const persisted = await service.persistRoutingSummary({
      caseId: 'case-1',
      iterationId: 'iter-1',
      iterationNo: 1,
      vcAverage: 7.4,
      evidenceCompleteness: 6.8,
      evidenceFreshness: 7.1,
      iterationWorthiness: 5.9,
      rationaleByDimension: {
        vcAverage: 'The core economics look credible.',
        iterationWorthiness: 'One more loop could answer remaining objections.',
      },
    });
    const summary = await service.getRoutingSummary('iter-1');

    expect(persisted).toHaveLength(4);
    expect(
      persisted.find((scoreDetail) => scoreDetail.dimension === 'vcAverage'),
    ).toMatchObject({
      scoringAgent: 'VCCritic',
      score: 7.4,
      rationale: 'The core economics look credible.',
    });
    expect(
      persisted.find(
        (scoreDetail) => scoreDetail.dimension === 'iterationWorthiness',
      ),
    ).toMatchObject({
      scoringAgent: 'Judge',
      score: 5.9,
      rationale: 'One more loop could answer remaining objections.',
    });
    expect(summary).toEqual({
      caseId: 'case-1',
      iterationId: 'iter-1',
      iterationNo: 1,
      vcAverage: 7.4,
      evidenceCompleteness: 6.8,
      evidenceFreshness: 7.1,
      iterationWorthiness: 5.9,
    });
  });
});
