export const CASE_STATUSES = [
  'NEW',
  'TOPIC_ACCEPTED',
  'RESEARCHING',
  'SYNTHESIZING',
  'VC_REVIEW',
  'JUDGE_REVIEW',
  'REVISE_REQUIRED',
  'PIVOT_REQUIRED',
  'APPROVED_FOR_PRD',
  'PRD_IN_PROGRESS',
  'POC_IN_PROGRESS',
  'COMPLETED',
  'REJECTED',
  'FAILED',
] as const;

export type CaseStatus = (typeof CASE_STATUSES)[number];

export const JUDGE_DECISIONS = ['PASS', 'REVISE', 'PIVOT', 'REJECT'] as const;

export type JudgeDecision = (typeof JUDGE_DECISIONS)[number];

export const AGENT_NAMES = [
  'FactResearcher',
  'OpportunityStrategist',
  'VCCritic',
  'Judge',
  'PRDStrategist',
  'POCArchitect',
] as const;

export type AgentName = (typeof AGENT_NAMES)[number];

export const RESEARCH_STYLES = [
  'BALANCED',
  'CUSTOMER_WORKFLOW',
  'COMPETITOR_INTENSIVE',
  'REGULATORY_RISK',
  'MARKET_TIMING',
] as const;

export type ResearchStyle = (typeof RESEARCH_STYLES)[number];

export const BROWSING_AUTONOMY_PROFILES = [
  'RESTRICTED',
  'STANDARD',
  'EXPANDED',
] as const;

export type BrowsingAutonomyProfile =
  (typeof BROWSING_AUTONOMY_PROFILES)[number];

export const JUDGE_TASK_TARGET_AGENTS = [
  'FACT_RESEARCHER',
  'OPPORTUNITY_STRATEGIST',
] as const;

export type JudgeTaskTargetAgent = (typeof JUDGE_TASK_TARGET_AGENTS)[number];

export const JUDGE_TASK_TYPES = [
  'FACT_RESEARCH',
  'STRATEGY_REFRAME',
  'EVIDENCE_REFRESH',
  'COMPETITOR_EXPANSION',
  'MONETIZATION_REWORK',
  'ICP_REFOCUS',
  'MVP_RESCOPING',
  'GTM_REWORK',
  'TERMINAL_RISK_CONFIRMATION',
] as const;

export type JudgeTaskType = (typeof JUDGE_TASK_TYPES)[number];

export const OVERRIDE_ACTIONS = [
  'FORCE_REVISE',
  'FORCE_PIVOT',
  'FORCE_PASS_TO_PRD',
  'FORCE_REJECT',
] as const;

export type OverrideAction = (typeof OVERRIDE_ACTIONS)[number];

export const FAILURE_CATEGORIES = [
  'INFRA_FAILURE',
  'SCHEMA_VALIDATION_FAILURE',
  'AGENT_TIMEOUT',
  'MALFORMED_OUTPUT',
  'INVALID_AGENT_OUTPUT',
  'NORMALIZATION_FAILURE',
  'STORAGE_FAILURE',
  'JUDGE_DEAD_END',
] as const;

export type FailureCategory = (typeof FAILURE_CATEGORIES)[number];

export const REJECTION_CATEGORIES = [
  'WEAK_MARKET',
  'WEAK_WILLINGNESS_TO_PAY',
  'WEAK_MOAT',
  'WEAK_GTM',
  'FOUNDER_MISMATCH',
  'EXCESSIVE_REGULATORY_BURDEN',
  'FEATURE_NOT_COMPANY',
  'INSUFFICIENT_EVIDENCE_AFTER_ITERATION_BUDGET',
] as const;

export type RejectionCategory = (typeof REJECTION_CATEGORIES)[number];

export const PERMISSION_LEVELS = ['L0', 'L1', 'L2', 'L3', 'L4'] as const;

export type PermissionLevel = (typeof PERMISSION_LEVELS)[number];

export const PROMPT_TEMPLATE_VERSION_STATES = ['ACTIVE', 'INACTIVE'] as const;

export type PromptTemplateVersionState =
  (typeof PROMPT_TEMPLATE_VERSION_STATES)[number];

export const FOUNDER_VALUE_MEASUREMENT_SOURCES = [
  'OPERATOR',
  'FOUNDER',
] as const;

export type FounderValueMeasurementSource =
  (typeof FOUNDER_VALUE_MEASUREMENT_SOURCES)[number];
