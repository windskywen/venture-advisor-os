import { z } from 'zod';

import { JUDGE_DECISIONS } from './enums.js';

export const COMMON_BASE_DECISION_LABELS = JUDGE_DECISIONS;
export const COMMON_BASE_SCORE_SCALE = {
  min: 1,
  max: 10,
} as const;

export const COMMON_BASE_OUTPUT_CONVENTIONS = {
  markdownSectionsRequired: true,
  jsonSummaryRequired: true,
  citationsRequiredForFacts: true,
  factInferenceAssumptionSeparationRequired: true,
} as const;

export const FACT_CLASSIFICATION_LABELS = [
  'FACT',
  'INFERENCE',
  'ASSUMPTION',
] as const;

export type FactClassificationLabel =
  (typeof FACT_CLASSIFICATION_LABELS)[number];

export const CommonBaseConventionsSchema = z.object({
  decisionLabels: z.enum(COMMON_BASE_DECISION_LABELS).array(),
  scoreScale: z.object({
    min: z.literal(COMMON_BASE_SCORE_SCALE.min),
    max: z.literal(COMMON_BASE_SCORE_SCALE.max),
  }),
  outputConventions: z.object({
    markdownSectionsRequired: z.literal(
      COMMON_BASE_OUTPUT_CONVENTIONS.markdownSectionsRequired,
    ),
    jsonSummaryRequired: z.literal(
      COMMON_BASE_OUTPUT_CONVENTIONS.jsonSummaryRequired,
    ),
    citationsRequiredForFacts: z.literal(
      COMMON_BASE_OUTPUT_CONVENTIONS.citationsRequiredForFacts,
    ),
    factInferenceAssumptionSeparationRequired: z.literal(
      COMMON_BASE_OUTPUT_CONVENTIONS.factInferenceAssumptionSeparationRequired,
    ),
  }),
  factClassificationLabels: z.enum(FACT_CLASSIFICATION_LABELS).array(),
});

export type CommonBaseConventions = z.infer<typeof CommonBaseConventionsSchema>;

export function isCommonBaseScore(value: number): boolean {
  return (
    value >= COMMON_BASE_SCORE_SCALE.min && value <= COMMON_BASE_SCORE_SCALE.max
  );
}
