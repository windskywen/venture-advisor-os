import type { PromptTemplateRegistry } from '@venture-advisor-os/agent-specs';

import { extractMarkdownPortion } from './markdown-acceptance.js';
import { extractJsonSummary } from './normalization-utils.js';

export interface OutputConventionValidationInput {
  registry: PromptTemplateRegistry;
  agentName: string;
  markdown: string;
  rawOutput: string;
}

export interface OutputConventionValidationResult {
  valid: boolean;
  errors: string[];
}

export interface OutputConventionAssertionInput {
  registry: PromptTemplateRegistry;
  agentName: string;
  rawOutput: string;
}

export function assertOutputConventions(
  input: OutputConventionAssertionInput,
): void {
  const result = validateOutputConventions({
    registry: input.registry,
    agentName: input.agentName,
    markdown: extractMarkdownPortion(input.rawOutput),
    rawOutput: input.rawOutput,
  });

  if (result.valid) {
    return;
  }

  throw new Error(result.errors.join(' '));
}

export function validateOutputConventions(
  input: OutputConventionValidationInput,
): OutputConventionValidationResult {
  const template = input.registry.agents[input.agentName];
  if (!template) {
    throw new Error(`Unknown prompt template agent: ${input.agentName}`);
  }

  const errors: string[] = [];
  const markdownValidation =
    template.requiredMarkdownSectionsSchema.safeParse(input.markdown);

  if (!markdownValidation.success) {
    errors.push(
      markdownValidation.error.issues[0]?.message ?? 'Invalid markdown sections.',
    );
  }

  let jsonSummary: unknown;
  try {
    jsonSummary = extractJsonSummary(input.rawOutput);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    jsonSummary = undefined;
  }

  if (jsonSummary === undefined) {
    errors.push('JSON summary is required.');
  }

  if (
    template.common.output_conventions.citation_required_for_facts &&
    requiresCitationMarkers(input.agentName) &&
    !hasCitationMarker(input.markdown)
  ) {
    errors.push('Citation markers are required for factual claims.');
  }

  if (!hasFactInferenceAssumptionLabels(input.markdown)) {
    errors.push(
      'Output must explicitly distinguish facts, inferences/hypotheses, and assumptions.',
    );
  }

  const scoringIssues = findOutOfRangeScores(
    jsonSummary,
    template.common.scoring_scale.min,
    template.common.scoring_scale.max,
  );
  errors.push(...scoringIssues);

  return {
    valid: errors.length === 0,
    errors,
  };
}

function requiresCitationMarkers(agentName: string): boolean {
  return agentName === 'FactResearcher' || agentName === 'Judge';
}

function hasCitationMarker(markdown: string): boolean {
  return /\[[^\]]+\]\([^)]+\)|\[\d+\]|Source:/iu.test(markdown);
}

function hasFactInferenceAssumptionLabels(markdown: string): boolean {
  const hasFactOrEvidence = /facts?|evidence/iu.test(markdown);
  const hasInferenceOrHypothesis = /inference|hypotheses|hypothesis/iu.test(
    markdown,
  );
  const hasAssumption = /assumptions?/iu.test(markdown);

  return hasFactOrEvidence && hasInferenceOrHypothesis && hasAssumption;
}

function findOutOfRangeScores(
  value: unknown,
  minScore: number,
  maxScore: number,
  path = 'json',
): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) =>
      findOutOfRangeScores(item, minScore, maxScore, `${path}[${index}]`),
    );
  }

  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, nestedValue]) => {
      if (key === 'score' && typeof nestedValue === 'number') {
        return nestedValue < minScore || nestedValue > maxScore
          ? [
              `Score at ${path}.${key} must be between ${minScore} and ${maxScore}.`,
            ]
          : [];
      }

      return findOutOfRangeScores(
        nestedValue,
        minScore,
        maxScore,
        `${path}.${key}`,
      );
    });
  }

  return [];
}
