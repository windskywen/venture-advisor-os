import { z } from 'zod';

import { JUDGE_DECISIONS } from './enums.js';
import { JudgeTaskPromptInputSchema } from './judge-task.js';

const StringArraySchema = z.array(z.string().min(1));

export const FactResearcherOutputSchema = z.object({
  market_problem_definition: z.string().min(1),
  target_user_segments: StringArraySchema,
  pain_points: StringArraySchema,
  workflow_gaps: StringArraySchema,
  current_alternatives: StringArraySchema,
  competitors: z.array(
    z.object({
      name: z.string().min(1).optional(),
      positioning: z.string().min(1).optional(),
      weakness_or_gap: z.string().min(1).optional(),
    }),
  ),
  evidence: z.array(
    z.object({
      claim: z.string().min(1).optional(),
      source_date: z.string().min(1).optional(),
      source_type: z.string().min(1).optional(),
      confidence: z.string().min(1).optional(),
    }),
  ),
  assumptions: StringArraySchema,
});

export type FactResearcherOutput = z.infer<typeof FactResearcherOutputSchema>;

export const OpportunityStrategistOutputSchema = z.object({
  opportunity_options: z.array(
    z.object({
      title: z.string().min(1).optional(),
      product_shape: z.string().min(1).optional(),
      target_user: z.string().min(1).optional(),
      core_pain: z.string().min(1).optional(),
      monetization: z.string().min(1).optional(),
      pros: StringArraySchema.optional(),
      cons: StringArraySchema.optional(),
    }),
  ),
  recommended_entry_point: z.object({
    title: z.string().min(1).optional(),
    rationale: z.string().min(1).optional(),
  }),
  business_model_hypotheses: StringArraySchema,
  mvp_direction: StringArraySchema,
  feasibility_scores: z.array(
    z.object({
      dimension: z.string().min(1).optional(),
      score: z.number().optional(),
      rationale: z.string().min(1).optional(),
    }),
  ),
  key_assumptions: StringArraySchema,
});

export type OpportunityStrategistOutput = z.infer<
  typeof OpportunityStrategistOutputSchema
>;

export const VcCriticOutputSchema = z.object({
  summary: z.string().min(1),
  objections: StringArraySchema,
  fatal_flaws: StringArraySchema,
  manageable_risks: StringArraySchema,
  score_breakdown: z.array(
    z.object({
      dimension: z.string().min(1).optional(),
      score: z.number().optional(),
      rationale: z.string().min(1).optional(),
    }),
  ),
  key_questions: StringArraySchema,
  recommendation: z.string().min(1),
});

export type VcCriticOutput = z.infer<typeof VcCriticOutputSchema>;

export const JudgeNextTaskOutputSchema = JudgeTaskPromptInputSchema;

export const JudgeOutputSchema = z.object({
  decision: z.enum(JUDGE_DECISIONS),
  rationale: z.string().min(1),
  accepted_objections: StringArraySchema,
  rejected_objections: StringArraySchema,
  evidence_assessment: z.object({
    completeness: z.number(),
    freshness: z.number(),
    confidence: z.number(),
  }),
  iteration_worthiness: z.object({
    should_continue: z.boolean(),
    reason: z.string().min(1),
  }),
  next_iteration_tasks: z.array(JudgeNextTaskOutputSchema),
  termination_warning: z.boolean(),
});

export type JudgeOutput = z.infer<typeof JudgeOutputSchema>;

export const PrdStrategistOutputSchema = z.object({
  product_overview: z.string().min(1),
  problem_statement: z.string().min(1),
  target_users: StringArraySchema,
  use_cases: StringArraySchema,
  functional_requirements: StringArraySchema,
  non_functional_requirements: StringArraySchema,
  mvp_scope: StringArraySchema,
  out_of_scope: StringArraySchema,
  user_stories: StringArraySchema,
  success_metrics: StringArraySchema,
  risks: StringArraySchema,
  open_questions: StringArraySchema,
});

export type PrdStrategistOutput = z.infer<typeof PrdStrategistOutputSchema>;

export const PocArchitectOutputSchema = z.object({
  poc_goal: z.string().min(1),
  validation_hypotheses: StringArraySchema,
  demo_scope: StringArraySchema,
  technical_architecture: StringArraySchema,
  core_modules: StringArraySchema,
  data_inputs: StringArraySchema,
  mock_vs_real: StringArraySchema,
  acceptance_criteria: StringArraySchema,
  build_tasks: StringArraySchema,
  risks_and_fallback: StringArraySchema,
});

export type PocArchitectOutput = z.infer<typeof PocArchitectOutputSchema>;
