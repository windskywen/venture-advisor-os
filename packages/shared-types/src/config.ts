import { z } from 'zod';

import {
  BROWSING_AUTONOMY_PROFILES,
  RESEARCH_STYLES,
} from './enums.js';

const WorkflowConfigSchema = z.object({
  thresholds: z.object({
    vcPass: z.number().min(0).max(10),
    evidencePass: z.number().min(0).max(10),
    minimumScoreImprovement: z.number().nonnegative(),
  }),
  judgeThresholds: z.object({
    vcPass: z.number().min(0).max(10),
    evidencePass: z.number().min(0).max(10),
  }),
  iterationBudget: z.object({
    standardTopicMaxIterations: z.number().int().positive(),
    complexTopicMaxIterations: z.number().int().positive(),
    maxStagnantIterations: z.number().int().nonnegative(),
  }),
  timeoutBudgets: z.object({
    agentRunMs: z.number().int().positive(),
    reportRenderMs: z.number().int().positive(),
    prdGenerationMs: z.number().int().positive(),
    pocGenerationMs: z.number().int().positive(),
  }),
  routingPolicy: z.object({
    preferTerminalDecisionByIteration: z.number().int().positive(),
    rejectOnConsecutiveStagnation: z.boolean(),
    rejectOnTerminationWarningWithoutMaterialImprovement: z.boolean(),
    rejectOnUnresolvedFatalFlaws: z.boolean(),
    allowReviseOnFatalFlawWithConcreteDisproofPath: z.boolean(),
    requireJudgePassForPassRouting: z.boolean(),
    requirePassForDownstreamGeneration: z.boolean(),
  }),
  research: z.object({
    defaultStyle: z.enum(RESEARCH_STYLES),
  }),
  browsingAutonomy: z.object({
    defaultProfile: z.enum(BROWSING_AUTONOMY_PROFILES),
    allowAdjacentExploration: z.boolean(),
    allowCompetitorExploration: z.boolean(),
    allowOpenEndedQueries: z.boolean(),
    maxSourcesPerQuery: z.number().int().positive().max(20),
    recencyWindowDays: z.number().int().positive(),
  }),
});

export type WorkflowConfig = z.infer<typeof WorkflowConfigSchema>;
export type EnvironmentLike = Record<string, string | undefined>;

export function loadWorkflowConfig(
  env: EnvironmentLike = getDefaultEnvironment(),
): WorkflowConfig {
  const judgeVcPass = readNumber(
    env,
    ['JUDGE_VC_PASS_THRESHOLD', 'VC_PASS_THRESHOLD', 'SCORE_THRESHOLD_PASS'],
    7.5,
  );
  const judgeEvidencePass = readNumber(
    env,
    [
      'JUDGE_EVIDENCE_PASS_THRESHOLD',
      'EVIDENCE_PASS_THRESHOLD',
      'SCORE_THRESHOLD_EVIDENCE',
    ],
    7.0,
  );
  const config = {
    thresholds: {
      vcPass: judgeVcPass,
      evidencePass: judgeEvidencePass,
      minimumScoreImprovement: readNumber(env, ['MIN_SCORE_IMPROVEMENT'], 0.4),
    },
    judgeThresholds: {
      vcPass: judgeVcPass,
      evidencePass: judgeEvidencePass,
    },
    iterationBudget: {
      standardTopicMaxIterations: readInteger(
        env,
        ['DEFAULT_MAX_ITERATIONS', 'MAX_ITERATIONS'],
        3,
      ),
      complexTopicMaxIterations: readInteger(
        env,
        ['COMPLEX_TOPIC_MAX_ITERATIONS'],
        5,
      ),
      maxStagnantIterations: readInteger(env, ['MAX_STAGNANT_ITERATIONS'], 2),
    },
    timeoutBudgets: {
      agentRunMs: readInteger(
        env,
        ['COPILOT_SDK_TIMEOUT_MS', 'AGENT_TIMEOUT_MS'],
        300000,
      ),
      reportRenderMs: readInteger(env, ['REPORT_RENDER_TIMEOUT_MS'], 60000),
      prdGenerationMs: readInteger(env, ['PRD_GENERATION_TIMEOUT_MS'], 120000),
      pocGenerationMs: readInteger(env, ['POC_GENERATION_TIMEOUT_MS'], 120000),
    },
    routingPolicy: {
      preferTerminalDecisionByIteration: readInteger(
        env,
        ['PREFER_TERMINAL_DECISION_BY_ITERATION'],
        3,
      ),
      rejectOnConsecutiveStagnation: readBoolean(
        env,
        ['REJECT_ON_CONSECUTIVE_STAGNATION'],
        true,
      ),
      rejectOnTerminationWarningWithoutMaterialImprovement: readBoolean(
        env,
        ['REJECT_ON_TERMINATION_WARNING_NEXT_WEAK_ITERATION'],
        true,
      ),
      rejectOnUnresolvedFatalFlaws: readBoolean(
        env,
        ['REJECT_ON_UNRESOLVED_FATAL_FLAWS'],
        true,
      ),
      allowReviseOnFatalFlawWithConcreteDisproofPath: readBoolean(
        env,
        ['ALLOW_REVISE_ON_FATAL_FLAW_WITH_DISPROOF_PATH'],
        true,
      ),
      requireJudgePassForPassRouting: readBoolean(
        env,
        ['REQUIRE_JUDGE_PASS_FOR_PASS_ROUTING'],
        true,
      ),
      requirePassForDownstreamGeneration: readBoolean(
        env,
        ['REQUIRE_PASS_FOR_DOWNSTREAM_GENERATION'],
        true,
      ),
    },
    research: {
      defaultStyle: readEnum(
        env,
        ['DEFAULT_RESEARCH_STYLE'],
        RESEARCH_STYLES,
        'BALANCED',
      ),
    },
    browsingAutonomy: {
      defaultProfile: readEnum(
        env,
        ['BROWSING_AUTONOMY_PROFILE'],
        BROWSING_AUTONOMY_PROFILES,
        'STANDARD',
      ),
      allowAdjacentExploration: readBoolean(
        env,
        ['BROWSING_ALLOW_ADJACENT_EXPLORATION'],
        false,
      ),
      allowCompetitorExploration: readBoolean(
        env,
        ['BROWSING_ALLOW_COMPETITOR_EXPLORATION'],
        true,
      ),
      allowOpenEndedQueries: readBoolean(
        env,
        ['BROWSING_ALLOW_OPEN_ENDED_QUERIES'],
        false,
      ),
      maxSourcesPerQuery: readInteger(
        env,
        ['BROWSING_MAX_SOURCES_PER_QUERY'],
        5,
      ),
      recencyWindowDays: readInteger(
        env,
        ['BROWSING_RECENCY_WINDOW_DAYS'],
        120,
      ),
    },
  };

  return WorkflowConfigSchema.parse(config);
}

function readNumber(
  env: EnvironmentLike,
  keys: readonly string[],
  defaultValue: number,
): number {
  const value = readFirstDefinedValue(env, keys);
  if (value === undefined) {
    return defaultValue;
  }

  return Number(value);
}

function readInteger(
  env: EnvironmentLike,
  keys: readonly string[],
  defaultValue: number,
): number {
  const value = readFirstDefinedValue(env, keys);
  if (value === undefined) {
    return defaultValue;
  }

  return Number.parseInt(value, 10);
}

function readBoolean(
  env: EnvironmentLike,
  keys: readonly string[],
  defaultValue: boolean,
): boolean {
  const value = readFirstDefinedValue(env, keys);
  if (value === undefined) {
    return defaultValue;
  }

  const normalizedValue = value.trim().toLowerCase();
  if (normalizedValue === 'true') {
    return true;
  }

  if (normalizedValue === 'false') {
    return false;
  }

  return defaultValue;
}

function readEnum<const Values extends readonly string[]>(
  env: EnvironmentLike,
  keys: readonly string[],
  supportedValues: Values,
  defaultValue: Values[number],
): Values[number] {
  const value = readFirstDefinedValue(env, keys);
  if (value === undefined) {
    return defaultValue;
  }

  return supportedValues.includes(value as Values[number])
    ? (value as Values[number])
    : defaultValue;
}

function readFirstDefinedValue(
  env: EnvironmentLike,
  keys: readonly string[],
): string | undefined {
  for (const key of keys) {
    const value = env[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }

  return undefined;
}

function getDefaultEnvironment(): EnvironmentLike {
  const processLike = (globalThis as { process?: { env?: EnvironmentLike } })
    .process;
  return processLike?.env ?? {};
}
