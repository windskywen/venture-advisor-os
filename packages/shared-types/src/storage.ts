export const STORAGE_ROOT_PREFIX = 'storage/cases';

export const CASE_ARTIFACT_FILE_NAMES = {
  case: 'case.json',
  approvedBusinessSummary: 'approved_business_summary.json',
  finalBusinessPlan: 'final_business_plan.md',
  prd: 'prd.md',
  pocSpec: 'poc_spec.md',
  implementationHandoff: 'implementation_handoff.json',
  codexExecutionPlan: 'codex_execution_plan.md',
} as const;

export const ITERATION_OUTPUT_FILE_NAMES = {
  marketFacts: 'market_facts.md',
  painEvidence: 'pain_evidence.md',
  competitorMap: 'competitor_map.md',
  opportunityOptions: 'opportunity_options.md',
  businessModelHypotheses: 'business_model_hypotheses.md',
  vcCriticReport: 'vc_critic_report.md',
  judgeDecision: 'judge_decision.json',
  decisionMemo: 'decision_memo.md',
} as const;

export const ITERATION_RAW_FILE_NAMES = {
  factResearcher: 'fact_researcher.raw.json',
  strategist: 'strategist.raw.json',
  vcCritic: 'vc_critic.raw.json',
  judge: 'judge.raw.json',
} as const;

export type CaseArtifactFileName =
  (typeof CASE_ARTIFACT_FILE_NAMES)[keyof typeof CASE_ARTIFACT_FILE_NAMES];

export type IterationOutputFileName =
  (typeof ITERATION_OUTPUT_FILE_NAMES)[keyof typeof ITERATION_OUTPUT_FILE_NAMES];

export type IterationRawFileName =
  (typeof ITERATION_RAW_FILE_NAMES)[keyof typeof ITERATION_RAW_FILE_NAMES];

export interface IterationStorageManifest {
  ref: string;
  root: string;
  inputsRoot: string;
  outputsRoot: string;
  rawRoot: string;
  outputFiles: Record<keyof typeof ITERATION_OUTPUT_FILE_NAMES, string>;
  rawFiles: Record<keyof typeof ITERATION_RAW_FILE_NAMES, string>;
}

export interface CaseStorageManifest {
  caseId: string;
  root: string;
  caseFile: string;
  approvedBusinessSummaryFile: string;
  finalBusinessPlanFile: string;
  prdFile: string;
  pocSpecFile: string;
  implementationHandoffFile: string;
  codexExecutionPlanFile: string;
}

export function createCaseStorageManifest(caseId: string): CaseStorageManifest {
  const root = `${STORAGE_ROOT_PREFIX}/${caseId}`;

  return {
    caseId,
    root,
    caseFile: `${root}/${CASE_ARTIFACT_FILE_NAMES.case}`,
    approvedBusinessSummaryFile: `${root}/${CASE_ARTIFACT_FILE_NAMES.approvedBusinessSummary}`,
    finalBusinessPlanFile: `${root}/${CASE_ARTIFACT_FILE_NAMES.finalBusinessPlan}`,
    prdFile: `${root}/${CASE_ARTIFACT_FILE_NAMES.prd}`,
    pocSpecFile: `${root}/${CASE_ARTIFACT_FILE_NAMES.pocSpec}`,
    implementationHandoffFile: `${root}/${CASE_ARTIFACT_FILE_NAMES.implementationHandoff}`,
    codexExecutionPlanFile: `${root}/${CASE_ARTIFACT_FILE_NAMES.codexExecutionPlan}`,
  };
}

export function createIterationStorageManifest(
  caseId: string,
  iterationNo: number,
): IterationStorageManifest {
  const caseManifest = createCaseStorageManifest(caseId);
  const root = `${caseManifest.root}/iterations/${iterationNo}`;
  const outputsRoot = `${root}/outputs`;
  const rawRoot = `${root}/raw`;

  return {
    ref: `${caseId}:iteration:${iterationNo}`,
    root,
    inputsRoot: `${root}/inputs`,
    outputsRoot,
    rawRoot,
    outputFiles: {
      marketFacts: `${outputsRoot}/${ITERATION_OUTPUT_FILE_NAMES.marketFacts}`,
      painEvidence: `${outputsRoot}/${ITERATION_OUTPUT_FILE_NAMES.painEvidence}`,
      competitorMap: `${outputsRoot}/${ITERATION_OUTPUT_FILE_NAMES.competitorMap}`,
      opportunityOptions: `${outputsRoot}/${ITERATION_OUTPUT_FILE_NAMES.opportunityOptions}`,
      businessModelHypotheses: `${outputsRoot}/${ITERATION_OUTPUT_FILE_NAMES.businessModelHypotheses}`,
      vcCriticReport: `${outputsRoot}/${ITERATION_OUTPUT_FILE_NAMES.vcCriticReport}`,
      judgeDecision: `${outputsRoot}/${ITERATION_OUTPUT_FILE_NAMES.judgeDecision}`,
      decisionMemo: `${outputsRoot}/${ITERATION_OUTPUT_FILE_NAMES.decisionMemo}`,
    },
    rawFiles: {
      factResearcher: `${rawRoot}/${ITERATION_RAW_FILE_NAMES.factResearcher}`,
      strategist: `${rawRoot}/${ITERATION_RAW_FILE_NAMES.strategist}`,
      vcCritic: `${rawRoot}/${ITERATION_RAW_FILE_NAMES.vcCritic}`,
      judge: `${rawRoot}/${ITERATION_RAW_FILE_NAMES.judge}`,
    },
  };
}

export function isAllowedStorageRelativePath(candidatePath: string): boolean {
  const normalizedPath = normalizeStoragePath(candidatePath);
  const caseRootPattern =
    /^storage\/cases\/[^/]+\/(case\.json|approved_business_summary\.json|final_business_plan\.md|prd\.md|poc_spec\.md|implementation_handoff\.json|codex_execution_plan\.md)$/u;
  const iterationOutputPattern =
    /^storage\/cases\/[^/]+\/iterations\/\d+\/outputs\/(market_facts\.md|pain_evidence\.md|competitor_map\.md|opportunity_options\.md|business_model_hypotheses\.md|vc_critic_report\.md|judge_decision\.json|decision_memo\.md)$/u;
  const iterationRawPattern =
    /^storage\/cases\/[^/]+\/iterations\/\d+\/raw\/(fact_researcher\.raw\.json|strategist\.raw\.json|vc_critic\.raw\.json|judge\.raw\.json)$/u;
  const iterationInputsPattern =
    /^storage\/cases\/[^/]+\/iterations\/\d+\/inputs\/.+$/u;

  return (
    caseRootPattern.test(normalizedPath) ||
    iterationOutputPattern.test(normalizedPath) ||
    iterationRawPattern.test(normalizedPath) ||
    iterationInputsPattern.test(normalizedPath)
  );
}

export function normalizeStoragePath(candidatePath: string): string {
  return candidatePath
    .replaceAll('\\', '/')
    .replaceAll(/\/{2,}/g, '/')
    .replace(/^\.\//u, '');
}
