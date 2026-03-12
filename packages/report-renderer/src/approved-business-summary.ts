import {
  ApprovedBusinessSummaryArtifactSchema,
  type ApprovedBusinessSummaryArtifact,
  type FactResearcherOutput,
  type JudgeOutput,
  type OpportunityStrategistOutput,
  type VcCriticOutput,
} from '@venture-advisor-os/shared-types';

export interface ComposeApprovedBusinessSummaryInput {
  caseId: string;
  topic: string;
  approvedIterationNo: number;
  factResearch: FactResearcherOutput;
  opportunityStrategy: OpportunityStrategistOutput;
  vcCritic: VcCriticOutput;
  judge: JudgeOutput;
  generatedAt?: string;
  sourceOutputRefs?: string[];
}

export function composeApprovedBusinessSummary(
  input: ComposeApprovedBusinessSummaryInput,
): ApprovedBusinessSummaryArtifact {
  if (input.judge.decision !== 'PASS') {
    throw new Error(
      `Approved business summary requires judge decision PASS, received ${input.judge.decision}.`,
    );
  }

  return ApprovedBusinessSummaryArtifactSchema.parse({
    caseId: input.caseId,
    approvedIterationNo: input.approvedIterationNo,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    sourceOutputRefs:
      input.sourceOutputRefs ?? defaultSourceOutputRefs(input.approvedIterationNo),
    summary: {
      topic: input.topic,
      market_problem_definition: input.factResearch.market_problem_definition,
      target_user_segments: input.factResearch.target_user_segments,
      pain_points: input.factResearch.pain_points,
      workflow_gaps: input.factResearch.workflow_gaps,
      current_alternatives: input.factResearch.current_alternatives,
      competitors: input.factResearch.competitors,
      evidence: input.factResearch.evidence,
      recommended_entry_point: input.opportunityStrategy.recommended_entry_point,
      opportunity_options: input.opportunityStrategy.opportunity_options,
      business_model_hypotheses:
        input.opportunityStrategy.business_model_hypotheses,
      mvp_direction: input.opportunityStrategy.mvp_direction,
      feasibility_scores: input.opportunityStrategy.feasibility_scores,
      key_assumptions: input.opportunityStrategy.key_assumptions,
      vc_summary: input.vcCritic.summary,
      objections: input.vcCritic.objections,
      manageable_risks: input.vcCritic.manageable_risks,
      key_questions: input.vcCritic.key_questions,
      judge_rationale: input.judge.rationale,
      accepted_objections: input.judge.accepted_objections,
      evidence_assessment: input.judge.evidence_assessment,
      why_approved: input.judge.iteration_worthiness.reason,
    },
  });
}

function defaultSourceOutputRefs(approvedIterationNo: number): string[] {
  return [
    `iteration:${approvedIterationNo}:FactResearcher`,
    `iteration:${approvedIterationNo}:OpportunityStrategist`,
    `iteration:${approvedIterationNo}:VCCritic`,
    `iteration:${approvedIterationNo}:Judge`,
  ];
}
