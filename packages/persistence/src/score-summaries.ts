import { randomUUID } from 'node:crypto';

import type { ScoreDetail } from '@venture-advisor-os/shared-types';

import type { PersistenceRepositories } from './repositories.js';

export const ROUTING_SCORE_DIMENSIONS = {
  vcAverage: 'vcAverage',
  evidenceCompleteness: 'evidenceCompleteness',
  evidenceFreshness: 'evidenceFreshness',
  evidenceConfidence: 'evidenceConfidence',
  iterationWorthiness: 'iterationWorthiness',
} as const;

type RoutingScoreDimensionKey = keyof typeof ROUTING_SCORE_DIMENSIONS;

export interface RoutingScoreSnapshot {
  caseId: string;
  iterationId: string;
  iterationNo: number;
  vcAverage?: number;
  evidenceCompleteness?: number;
  evidenceFreshness?: number;
  evidenceConfidence?: number;
  iterationWorthiness?: number;
}

export interface PersistRoutingSummaryInput extends RoutingScoreSnapshot {
  rationaleByDimension?: Partial<
    Record<(typeof ROUTING_SCORE_DIMENSIONS)[RoutingScoreDimensionKey], string>
  >;
}

export interface ScoreSummaryService {
  persistRoutingSummary(
    input: PersistRoutingSummaryInput,
  ): Promise<ScoreDetail[]>;
  getRoutingSummary(iterationId: string): Promise<RoutingScoreSnapshot | null>;
}

export function createScoreSummaryService(
  repositories: Pick<PersistenceRepositories, 'scoreDetails'>,
): ScoreSummaryService {
  return {
    async persistRoutingSummary(input) {
      const scoreDetails: ScoreDetail[] = [];
      const rationaleByDimension = input.rationaleByDimension ?? {};

      appendSummaryScore(
        scoreDetails,
        input,
        'vcAverage',
        'VCCritic',
        rationaleByDimension,
      );
      appendSummaryScore(
        scoreDetails,
        input,
        'evidenceCompleteness',
        'Judge',
        rationaleByDimension,
      );
      appendSummaryScore(
        scoreDetails,
        input,
        'evidenceFreshness',
        'Judge',
        rationaleByDimension,
      );
      appendSummaryScore(
        scoreDetails,
        input,
        'evidenceConfidence',
        'Judge',
        rationaleByDimension,
      );
      appendSummaryScore(
        scoreDetails,
        input,
        'iterationWorthiness',
        'Judge',
        rationaleByDimension,
      );

      return repositories.scoreDetails.insertMany(scoreDetails);
    },
    async getRoutingSummary(iterationId) {
      const scoreDetails =
        await repositories.scoreDetails.listByIterationId(iterationId);

      if (scoreDetails.length === 0) {
        return null;
      }

      const summary: RoutingScoreSnapshot = {
        caseId: scoreDetails[0].caseId,
        iterationId: scoreDetails[0].iterationId,
        iterationNo: scoreDetails[0].iterationNo,
      };

      for (const detail of scoreDetails) {
        switch (detail.dimension) {
          case ROUTING_SCORE_DIMENSIONS.vcAverage:
            summary.vcAverage = detail.score;
            break;
          case ROUTING_SCORE_DIMENSIONS.evidenceCompleteness:
            summary.evidenceCompleteness = detail.score;
            break;
          case ROUTING_SCORE_DIMENSIONS.evidenceFreshness:
            summary.evidenceFreshness = detail.score;
            break;
          case ROUTING_SCORE_DIMENSIONS.evidenceConfidence:
            summary.evidenceConfidence = detail.score;
            break;
          case ROUTING_SCORE_DIMENSIONS.iterationWorthiness:
            summary.iterationWorthiness = detail.score;
            break;
          default:
            break;
        }
      }

      return summary;
    },
  };
}

function appendSummaryScore(
  scoreDetails: ScoreDetail[],
  input: PersistRoutingSummaryInput,
  propertyKey: RoutingScoreDimensionKey,
  scoringAgent: ScoreDetail['scoringAgent'],
  rationaleByDimension: Partial<
    Record<(typeof ROUTING_SCORE_DIMENSIONS)[RoutingScoreDimensionKey], string>
  >,
): void {
  const score = input[propertyKey];
  if (typeof score !== 'number') {
    return;
  }

  const dimension = ROUTING_SCORE_DIMENSIONS[propertyKey];
  scoreDetails.push({
    scoreDetailId: randomUUID(),
    caseId: input.caseId,
    iterationId: input.iterationId,
    iterationNo: input.iterationNo,
    scoringAgent,
    dimension,
    score,
    rationale: rationaleByDimension[dimension],
  });
}
