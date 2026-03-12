import { z } from 'zod';
import {
  AGENT_NAMES,
  ApprovalSchema,
  type Approval,
  CopilotModelSelectionSchema,
  type CopilotModelSelection,
  AuditLogSchema,
  type AuditLog,
  AgentOutputSchema,
  type AgentOutput,
  type AgentName,
  createBrowsingAutonomySettings,
  DEFAULT_RESEARCH_STYLE,
  FounderValueMeasurementSchema,
  type FounderValueMeasurement,
  IterationSchema,
  type Iteration,
  JudgeTaskSchema,
  type JudgeTask,
  OpportunityCaseSchema,
  type OpportunityCase,
  PROMPT_TEMPLATE_VERSION_STATES,
  ScoreDetailSchema,
  type ScoreDetail,
} from '@venture-advisor-os/shared-types';

import type { PersistenceDatabase, SqlExecutor } from './database.js';

const JsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(JsonValueSchema),
    z.record(z.string(), JsonValueSchema),
  ]),
);

const COPILOT_MODEL_SELECTION_SETTING_KEY = 'copilot-model-selection';

export const PromptTemplateVersionSchema = z.object({
  templateVersionId: z.string().min(1),
  agentName: z.enum(AGENT_NAMES),
  version: z.string().min(1),
  templateBody: z.string().min(1),
  schemaBody: JsonValueSchema,
  state: z.enum(PROMPT_TEMPLATE_VERSION_STATES),
  createdAt: z.string().min(1),
});

export type PromptTemplateVersion = z.infer<typeof PromptTemplateVersionSchema>;
export type LatestNormalizedAgentOutputs = Partial<
  Record<AgentName, Record<string, unknown>>
>;

export interface ResolveApprovalInput {
  approvalId: string;
  status: string;
  resolvedAt: string;
  resolvedBy: string;
  metadata?: Record<string, unknown>;
}

export interface ResolveOverrideInput extends ResolveApprovalInput {
  auditLog: AuditLog;
}

export interface PersistenceRepositories {
  runtimeSettings: {
    getCopilotModelSelection(): Promise<CopilotModelSelection | null>;
    setCopilotModelSelection(
      selection: CopilotModelSelection,
    ): Promise<CopilotModelSelection>;
  };
  cases: {
    create(caseRecord: OpportunityCase): Promise<OpportunityCase>;
    getById(caseId: string): Promise<OpportunityCase | null>;
    getNextPendingCase(): Promise<OpportunityCase | null>;
    listAll(): Promise<OpportunityCase[]>;
    update(caseRecord: OpportunityCase): Promise<OpportunityCase>;
    delete(caseId: string): Promise<boolean>;
  };
  iterations: {
    create(iteration: Iteration): Promise<Iteration>;
    getById(iterationId: string): Promise<Iteration | null>;
    update(iteration: Iteration): Promise<Iteration>;
    listByCaseId(caseId: string): Promise<Iteration[]>;
    listAll(): Promise<Iteration[]>;
  };
  agentOutputs: {
    create(agentOutput: AgentOutput): Promise<AgentOutput>;
    listByIterationId(iterationId: string): Promise<AgentOutput[]>;
    listByCaseId(caseId: string): Promise<AgentOutput[]>;
    listAll(): Promise<AgentOutput[]>;
    getLatestByCaseIdAndAgentName(
      caseId: string,
      agentName: AgentName,
    ): Promise<AgentOutput | null>;
    getLatestNormalizedByCaseId(
      caseId: string,
    ): Promise<LatestNormalizedAgentOutputs>;
  };
  judgeTasks: {
    replaceForIteration(
      iterationId: string,
      tasks: readonly JudgeTask[],
    ): Promise<JudgeTask[]>;
    listByIterationId(iterationId: string): Promise<JudgeTask[]>;
  };
  scoreDetails: {
    insertMany(scoreDetails: readonly ScoreDetail[]): Promise<ScoreDetail[]>;
    listByIterationId(iterationId: string): Promise<ScoreDetail[]>;
  };
  auditLogs: {
    create(auditLog: AuditLog): Promise<AuditLog>;
    listByCaseId(caseId: string): Promise<AuditLog[]>;
    listAll(): Promise<AuditLog[]>;
  };
  founderValueMeasurements: {
    create(
      measurement: FounderValueMeasurement,
    ): Promise<FounderValueMeasurement>;
    listByCaseId(caseId: string): Promise<FounderValueMeasurement[]>;
    listAll(): Promise<FounderValueMeasurement[]>;
  };
  approvals: {
    create(approval: Approval): Promise<Approval>;
    resolve(input: ResolveApprovalInput): Promise<Approval | null>;
    listByCaseId(caseId: string): Promise<Approval[]>;
  };
  promptTemplateVersions: {
    create(record: PromptTemplateVersion): Promise<PromptTemplateVersion>;
    listByAgentName(agentName: AgentName): Promise<PromptTemplateVersion[]>;
    getActiveByAgentName(
      agentName: AgentName,
    ): Promise<PromptTemplateVersion | null>;
    setActive(
      agentName: AgentName,
      templateVersionId: string,
    ): Promise<PromptTemplateVersion | null>;
  };
}

export interface PersistenceService extends PersistenceRepositories {
  resolveOverride(input: ResolveOverrideInput): Promise<Approval | null>;
}

export function createPersistenceRepositories(
  executor: SqlExecutor,
): PersistenceRepositories {
  return {
    runtimeSettings: {
      async getCopilotModelSelection() {
        const result = await executor.query(
          `
            SELECT setting_value
            FROM runtime_settings
            WHERE setting_key = $1
          `,
          [COPILOT_MODEL_SELECTION_SETTING_KEY],
        );

        if (!result.rows[0]) {
          return null;
        }

        return mapCopilotModelSelection(result.rows[0]);
      },
      async setCopilotModelSelection(selection) {
        const record = CopilotModelSelectionSchema.parse(selection);
        const result = await executor.query(
          `
            INSERT INTO runtime_settings (setting_key, setting_value, updated_at)
            VALUES ($1, $2::jsonb, $3)
            ON CONFLICT (setting_key)
            DO UPDATE SET
              setting_value = EXCLUDED.setting_value,
              updated_at = EXCLUDED.updated_at
            RETURNING setting_value
          `,
          [
            COPILOT_MODEL_SELECTION_SETTING_KEY,
            toJsonb(record),
            record.updatedAt,
          ],
        );

        return mapCopilotModelSelection(result.rows[0]);
      },
    },
    cases: {
      async create(caseRecord) {
        const record = OpportunityCaseSchema.parse(caseRecord);
        await executor.query(
          `
            INSERT INTO opportunity_cases (
              case_id,
              topic,
              region,
              founder_profile,
              preferred_business_models,
              constraints,
              research_style,
              browsing_autonomy,
              status,
              current_iteration,
              max_iterations,
              approved_source_iteration_id,
              approved_source_iteration_no,
              final_decision,
              failure_category,
              rejection_rationale,
              rejection_category,
              portfolio_escalation_metadata,
              manual_review_required,
              created_at,
              updated_at
            )
            VALUES (
              $1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8::jsonb, $9, $10, $11, $12, $13, $14, $15, $16, $17::jsonb, $18, $19, $20, $21
            )
          `,
          [
            record.caseId,
            record.topic,
            record.region ?? null,
            record.founderProfile ?? null,
            toJsonb(record.preferredBusinessModels),
            toJsonb(record.constraints),
            record.researchStyle ?? DEFAULT_RESEARCH_STYLE,
            toJsonb(
              record.browsingAutonomy ?? createBrowsingAutonomySettings(),
            ),
            record.status,
            record.currentIteration,
            record.maxIterations,
            record.approvedSourceIterationId ?? null,
            record.approvedSourceIterationNo ?? null,
            record.finalDecision ?? null,
            record.failureCategory ?? null,
            record.rejectionRationale ?? null,
            record.rejectionCategory ?? null,
            toJsonb(record.portfolioEscalationMetadata),
            record.manualReviewRequired,
            record.createdAt,
            record.updatedAt,
          ],
        );
        return record;
      },
      async getById(caseId) {
        const result = await executor.query(
          `SELECT * FROM opportunity_cases WHERE case_id = $1`,
          [caseId],
        );

        return result.rows[0] ? mapOpportunityCase(result.rows[0]) : null;
      },
      async getNextPendingCase() {
        const result = await executor.query(
          `
            SELECT *
            FROM opportunity_cases
            WHERE status IN ('TOPIC_ACCEPTED', 'REVISE_REQUIRED', 'PIVOT_REQUIRED')
               OR (status = 'FAILED' AND manual_review_required = TRUE)
            ORDER BY
              CASE
                WHEN status IN ('TOPIC_ACCEPTED', 'REVISE_REQUIRED', 'PIVOT_REQUIRED') THEN 0
                ELSE 1
              END,
              created_at ASC,
              case_id ASC
            LIMIT 1
          `,
        );

        return result.rows[0] ? mapOpportunityCase(result.rows[0]) : null;
      },
      async listAll() {
        const result = await executor.query(
          `
            SELECT *
            FROM opportunity_cases
            ORDER BY created_at, case_id
          `,
        );
        return result.rows.map(mapOpportunityCase);
      },
      async update(caseRecord) {
        const record = OpportunityCaseSchema.parse(caseRecord);
        const result = await executor.query(
          `
            UPDATE opportunity_cases
            SET
              topic = $2,
              region = $3,
              founder_profile = $4,
              preferred_business_models = $5::jsonb,
              constraints = $6::jsonb,
              status = $7,
              current_iteration = $8,
              max_iterations = $9,
              approved_source_iteration_id = $10,
              approved_source_iteration_no = $11,
              final_decision = $12,
              failure_category = $13,
              rejection_rationale = $14,
              rejection_category = $15,
              portfolio_escalation_metadata = $16::jsonb,
              manual_review_required = $17,
              research_style = $18,
              browsing_autonomy = $19::jsonb,
              updated_at = $20
            WHERE case_id = $1
            RETURNING *
          `,
          [
            record.caseId,
            record.topic,
            record.region ?? null,
            record.founderProfile ?? null,
            toJsonb(record.preferredBusinessModels),
            toJsonb(record.constraints),
            record.status,
            record.currentIteration,
            record.maxIterations,
            record.approvedSourceIterationId ?? null,
            record.approvedSourceIterationNo ?? null,
            record.finalDecision ?? null,
            record.failureCategory ?? null,
            record.rejectionRationale ?? null,
            record.rejectionCategory ?? null,
            toJsonb(record.portfolioEscalationMetadata),
            record.manualReviewRequired,
            record.researchStyle ?? DEFAULT_RESEARCH_STYLE,
            toJsonb(
              record.browsingAutonomy ?? createBrowsingAutonomySettings(),
            ),
            record.updatedAt,
          ],
        );

        return mapOpportunityCase(result.rows[0]);
      },
      async delete(caseId) {
        const result = await executor.query(
          `DELETE FROM opportunity_cases WHERE case_id = $1`,
          [caseId],
        );
        return (result.rowCount ?? 0) > 0;
      },
    },
    iterations: {
      async create(iteration) {
        const record = IterationSchema.parse(iteration);
        await executor.query(
          `
            INSERT INTO case_iterations (
              iteration_id,
              case_id,
              iteration_no,
              status_at_start,
              status_at_end,
              judge_decision,
              started_at,
              completed_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `,
          [
            record.iterationId,
            record.caseId,
            record.iterationNo,
            record.statusAtStart ?? null,
            record.statusAtEnd ?? null,
            record.judgeDecision ?? null,
            record.startedAt,
            record.completedAt ?? null,
          ],
        );
        return record;
      },
      async getById(iterationId) {
        const result = await executor.query(
          `
            SELECT *
            FROM case_iterations
            WHERE iteration_id = $1
          `,
          [iterationId],
        );
        return result.rows[0] ? mapIteration(result.rows[0]) : null;
      },
      async update(iteration) {
        const record = IterationSchema.parse(iteration);
        const result = await executor.query(
          `
            UPDATE case_iterations
            SET
              status_at_start = $2,
              status_at_end = $3,
              judge_decision = $4,
              started_at = $5,
              completed_at = $6
            WHERE iteration_id = $1
            RETURNING *
          `,
          [
            record.iterationId,
            record.statusAtStart ?? null,
            record.statusAtEnd ?? null,
            record.judgeDecision ?? null,
            record.startedAt,
            record.completedAt ?? null,
          ],
        );
        return mapIteration(result.rows[0]);
      },
      async listByCaseId(caseId) {
        const result = await executor.query(
          `
            SELECT *
            FROM case_iterations
            WHERE case_id = $1
            ORDER BY iteration_no
          `,
          [caseId],
        );
        return result.rows.map(mapIteration);
      },
      async listAll() {
        const result = await executor.query(
          `
            SELECT *
            FROM case_iterations
            ORDER BY case_id, iteration_no
          `,
        );
        return result.rows.map(mapIteration);
      },
    },
    agentOutputs: {
      async create(agentOutput) {
        const record = AgentOutputSchema.parse(agentOutput);
        await executor.query(
          `
            INSERT INTO agent_outputs (
              agent_output_id,
              case_id,
              iteration_id,
              iteration_no,
              agent_name,
              raw_output,
              normalized_output,
              validation_errors,
              token_usage,
              latency_ms,
              created_at
            )
            VALUES (
              $1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb, $10, $11
            )
          `,
          [
            record.agentOutputId,
            record.caseId,
            record.iterationId,
            record.iterationNo,
            record.agentName,
            toJsonb(record.rawOutput),
            toJsonb(record.normalizedOutput),
            toJsonb(record.validationErrors),
            record.tokenUsage ? toJsonb(record.tokenUsage) : null,
            record.latencyMs ?? null,
            record.createdAt,
          ],
        );
        return record;
      },
      async listByIterationId(iterationId) {
        const result = await executor.query(
          `
            SELECT *
            FROM agent_outputs
            WHERE iteration_id = $1
            ORDER BY created_at, agent_name
          `,
          [iterationId],
        );
        return result.rows.map(mapAgentOutput);
      },
      async listByCaseId(caseId) {
        const result = await executor.query(
          `
            SELECT *
            FROM agent_outputs
            WHERE case_id = $1
            ORDER BY iteration_no, created_at, agent_name
          `,
          [caseId],
        );
        return result.rows.map(mapAgentOutput);
      },
      async listAll() {
        const result = await executor.query(
          `
            SELECT *
            FROM agent_outputs
            ORDER BY case_id, iteration_no, created_at, agent_name
          `,
        );
        return result.rows.map(mapAgentOutput);
      },
      async getLatestByCaseIdAndAgentName(caseId, agentName) {
        const result = await executor.query(
          `
            SELECT *
            FROM agent_outputs
            WHERE case_id = $1 AND agent_name = $2
            ORDER BY iteration_no DESC, created_at DESC
            LIMIT 1
          `,
          [caseId, agentName],
        );
        return result.rows[0] ? mapAgentOutput(result.rows[0]) : null;
      },
      async getLatestNormalizedByCaseId(caseId) {
        const result = await executor.query(
          `
            SELECT DISTINCT ON (agent_name)
              agent_name,
              normalized_output
            FROM agent_outputs
            WHERE case_id = $1
            ORDER BY agent_name, iteration_no DESC, created_at DESC
          `,
          [caseId],
        );

        return result.rows.reduce<LatestNormalizedAgentOutputs>((acc, row) => {
          acc[row.agent_name as AgentName] = mapNormalizedOutput(row);
          return acc;
        }, {});
      },
    },
    judgeTasks: {
      async replaceForIteration(iterationId, tasks) {
        const records = tasks.map((task) => JudgeTaskSchema.parse(task));
        await executor.query(
          `DELETE FROM judge_tasks WHERE iteration_id = $1`,
          [iterationId],
        );

        for (const record of records) {
          await executor.query(
            `
              INSERT INTO judge_tasks (
                task_id,
                case_id,
                iteration_id,
                iteration_no,
                task_type,
                target_agent,
                description,
                blocking,
                created_at
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
            `,
            [
              record.taskId,
              record.caseId,
              record.iterationId,
              record.iterationNo,
              record.taskType,
              record.targetAgent,
              record.description,
              record.blocking,
            ],
          );
        }

        return records;
      },
      async listByIterationId(iterationId) {
        const result = await executor.query(
          `
            SELECT *
            FROM judge_tasks
            WHERE iteration_id = $1
            ORDER BY created_at, task_id
          `,
          [iterationId],
        );
        return result.rows.map(mapJudgeTask);
      },
    },
    scoreDetails: {
      async insertMany(scoreDetails) {
        const records = scoreDetails.map((scoreDetail) =>
          ScoreDetailSchema.parse(scoreDetail),
        );

        for (const record of records) {
          await executor.query(
            `
              INSERT INTO score_details (
                score_detail_id,
                case_id,
                iteration_id,
                iteration_no,
                scoring_agent,
                dimension,
                score,
                rationale,
                created_at
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
            `,
            [
              record.scoreDetailId,
              record.caseId,
              record.iterationId,
              record.iterationNo,
              record.scoringAgent,
              record.dimension,
              record.score,
              record.rationale ?? null,
            ],
          );
        }

        return records;
      },
      async listByIterationId(iterationId) {
        const result = await executor.query(
          `
            SELECT *
            FROM score_details
            WHERE iteration_id = $1
            ORDER BY created_at, score_detail_id
          `,
          [iterationId],
        );
        return result.rows.map(mapScoreDetail);
      },
    },
    auditLogs: {
      async create(auditLog) {
        const record = AuditLogSchema.parse(auditLog);
        await executor.query(
          `
            INSERT INTO audit_logs (
              audit_log_id,
              case_id,
              iteration_id,
              iteration_no,
              action,
              actor,
              metadata,
              created_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
          `,
          [
            record.auditLogId,
            record.caseId,
            record.iterationId ?? null,
            record.iterationNo ?? null,
            record.action,
            record.actor,
            toJsonb(record.metadata),
            record.createdAt,
          ],
        );
        return record;
      },
      async listByCaseId(caseId) {
        const result = await executor.query(
          `
            SELECT *
            FROM audit_logs
            WHERE case_id = $1
            ORDER BY created_at, audit_log_id
          `,
          [caseId],
        );
        return result.rows.map(mapAuditLog);
      },
      async listAll() {
        const result = await executor.query(
          `
            SELECT *
            FROM audit_logs
            ORDER BY created_at, audit_log_id
          `,
        );
        return result.rows.map(mapAuditLog);
      },
    },
    founderValueMeasurements: {
      async create(measurement) {
        const record = FounderValueMeasurementSchema.parse(measurement);
        await executor.query(
          `
            INSERT INTO founder_value_measurements (
              measurement_id,
              case_id,
              respondent_type,
              actor,
              perceived_usefulness_score,
              confidence_increase_score,
              manual_research_minutes_saved,
              notes,
              created_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          `,
          [
            record.measurementId,
            record.caseId,
            record.respondentType,
            record.actor,
            record.perceivedUsefulnessScore,
            record.confidenceIncreaseScore,
            record.manualResearchMinutesSaved,
            record.notes ?? null,
            record.createdAt,
          ],
        );
        return record;
      },
      async listByCaseId(caseId) {
        const result = await executor.query(
          `
            SELECT *
            FROM founder_value_measurements
            WHERE case_id = $1
            ORDER BY created_at, measurement_id
          `,
          [caseId],
        );
        return result.rows.map(mapFounderValueMeasurement);
      },
      async listAll() {
        const result = await executor.query(
          `
            SELECT *
            FROM founder_value_measurements
            ORDER BY created_at, measurement_id
          `,
        );
        return result.rows.map(mapFounderValueMeasurement);
      },
    },
    approvals: {
      async create(approval) {
        const record = ApprovalSchema.parse(approval);
        await executor.query(
          `
            INSERT INTO approvals (
              approval_id,
              case_id,
              iteration_id,
              requested_action,
              status,
              requested_at,
              resolved_at,
              resolved_by,
              metadata
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
          `,
          [
            record.approvalId,
            record.caseId,
            record.iterationId,
            record.requestedAction,
            record.status,
            record.requestedAt,
            record.resolvedAt ?? null,
            record.resolvedBy ?? null,
            toJsonb(record.metadata),
          ],
        );
        return record;
      },
      async resolve(input) {
        const metadata = input.metadata ?? {};
        const result = await executor.query(
          `
            UPDATE approvals
            SET
              status = $2,
              resolved_at = $3,
              resolved_by = $4,
              metadata = $5::jsonb
            WHERE approval_id = $1
            RETURNING *
          `,
          [
            input.approvalId,
            input.status,
            input.resolvedAt,
            input.resolvedBy,
            toJsonb(metadata),
          ],
        );
        return result.rows[0] ? mapApproval(result.rows[0]) : null;
      },
      async listByCaseId(caseId) {
        const result = await executor.query(
          `
            SELECT *
            FROM approvals
            WHERE case_id = $1
            ORDER BY requested_at, approval_id
          `,
          [caseId],
        );
        return result.rows.map(mapApproval);
      },
    },
    promptTemplateVersions: {
      async create(record) {
        const parsed = PromptTemplateVersionSchema.parse(record);
        await executor.query(
          `
            INSERT INTO prompt_template_versions (
              template_version_id,
              agent_name,
              version,
              template_body,
              schema_body,
              is_active,
              created_at
            )
            VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
          `,
          [
            parsed.templateVersionId,
            parsed.agentName,
            parsed.version,
            parsed.templateBody,
            toJsonb(parsed.schemaBody),
            parsed.state === 'ACTIVE',
            parsed.createdAt,
          ],
        );
        return parsed;
      },
      async listByAgentName(agentName) {
        const result = await executor.query(
          `
            SELECT *
            FROM prompt_template_versions
            WHERE agent_name = $1
            ORDER BY created_at DESC, template_version_id DESC
          `,
          [agentName],
        );
        return result.rows.map(mapPromptTemplateVersion);
      },
      async getActiveByAgentName(agentName) {
        const result = await executor.query(
          `
            SELECT *
            FROM prompt_template_versions
            WHERE agent_name = $1 AND is_active = TRUE
            ORDER BY created_at DESC, template_version_id DESC
            LIMIT 1
          `,
          [agentName],
        );
        return result.rows[0] ? mapPromptTemplateVersion(result.rows[0]) : null;
      },
      async setActive(agentName, templateVersionId) {
        await executor.query(
          `
            UPDATE prompt_template_versions
            SET is_active = FALSE
            WHERE agent_name = $1
          `,
          [agentName],
        );
        const result = await executor.query(
          `
            UPDATE prompt_template_versions
            SET is_active = TRUE
            WHERE agent_name = $1 AND template_version_id = $2
            RETURNING *
          `,
          [agentName, templateVersionId],
        );
        return result.rows[0] ? mapPromptTemplateVersion(result.rows[0]) : null;
      },
    },
  };
}

export function createPersistenceService(
  executor: PersistenceDatabase,
): PersistenceService {
  const repositories = createPersistenceRepositories(executor);

  return {
    ...repositories,
    resolveOverride(input) {
      return executor.withTransaction(async (transaction) => {
        const scopedRepositories = createPersistenceRepositories(transaction);
        const approval = await scopedRepositories.approvals.resolve(input);

        if (!approval) {
          return null;
        }

        await scopedRepositories.auditLogs.create(input.auditLog);
        return approval;
      });
    },
  };
}

function mapOpportunityCase(row: Record<string, unknown>): OpportunityCase {
  return OpportunityCaseSchema.parse({
    caseId: row.case_id,
    topic: row.topic,
    region: row.region ?? undefined,
    founderProfile: row.founder_profile ?? undefined,
    preferredBusinessModels: row.preferred_business_models,
    constraints: row.constraints,
    researchStyle: row.research_style ?? undefined,
    browsingAutonomy:
      row.browsing_autonomy === null || row.browsing_autonomy === undefined
        ? undefined
        : row.browsing_autonomy,
    status: row.status,
    currentIteration: row.current_iteration,
    maxIterations: row.max_iterations,
    approvedSourceIterationId: row.approved_source_iteration_id ?? undefined,
    approvedSourceIterationNo: row.approved_source_iteration_no ?? undefined,
    finalDecision: row.final_decision ?? undefined,
    failureCategory: row.failure_category ?? undefined,
    rejectionRationale: row.rejection_rationale ?? undefined,
    rejectionCategory: row.rejection_category ?? undefined,
    portfolioEscalationMetadata: row.portfolio_escalation_metadata ?? {},
    manualReviewRequired: row.manual_review_required,
    createdAt: toTimestamp(row.created_at),
    updatedAt: toTimestamp(row.updated_at),
  });
}

function mapCopilotModelSelection(
  row: Record<string, unknown>,
): CopilotModelSelection {
  return CopilotModelSelectionSchema.parse(row.setting_value);
}

function mapIteration(row: Record<string, unknown>): Iteration {
  return IterationSchema.parse({
    iterationId: row.iteration_id,
    caseId: row.case_id,
    iterationNo: row.iteration_no,
    statusAtStart: row.status_at_start ?? undefined,
    statusAtEnd: row.status_at_end ?? undefined,
    judgeDecision: row.judge_decision ?? undefined,
    startedAt: toTimestamp(row.started_at),
    completedAt:
      row.completed_at === null || row.completed_at === undefined
        ? undefined
        : toTimestamp(row.completed_at),
  });
}

function mapAgentOutput(row: Record<string, unknown>): AgentOutput {
  return AgentOutputSchema.parse({
    agentOutputId: row.agent_output_id,
    caseId: row.case_id,
    iterationId: row.iteration_id,
    iterationNo: row.iteration_no,
    agentName: row.agent_name,
    rawOutput: row.raw_output,
    normalizedOutput: row.normalized_output,
    validationErrors: row.validation_errors,
    tokenUsage: row.token_usage ?? undefined,
    latencyMs: row.latency_ms ?? undefined,
    createdAt: toTimestamp(row.created_at),
  });
}

function mapNormalizedOutput(
  row: Record<string, unknown>,
): Record<string, unknown> {
  return z.record(z.string(), JsonValueSchema).parse(row.normalized_output);
}

function mapJudgeTask(row: Record<string, unknown>): JudgeTask {
  return JudgeTaskSchema.parse({
    taskId: row.task_id,
    caseId: row.case_id,
    iterationId: row.iteration_id,
    iterationNo: row.iteration_no,
    taskType: row.task_type,
    targetAgent: row.target_agent,
    description: row.description,
    blocking: row.blocking,
  });
}

function mapScoreDetail(row: Record<string, unknown>): ScoreDetail {
  return ScoreDetailSchema.parse({
    scoreDetailId: row.score_detail_id,
    caseId: row.case_id,
    iterationId: row.iteration_id,
    iterationNo: row.iteration_no,
    scoringAgent: row.scoring_agent,
    dimension: row.dimension,
    score: Number(row.score),
    rationale: row.rationale ?? undefined,
  });
}

function mapAuditLog(row: Record<string, unknown>): AuditLog {
  return AuditLogSchema.parse({
    auditLogId: row.audit_log_id,
    caseId: row.case_id,
    iterationId: row.iteration_id ?? undefined,
    iterationNo: row.iteration_no ?? undefined,
    action: row.action,
    actor: row.actor,
    metadata: row.metadata,
    createdAt: toTimestamp(row.created_at),
  });
}

function mapFounderValueMeasurement(
  row: Record<string, unknown>,
): FounderValueMeasurement {
  return FounderValueMeasurementSchema.parse({
    measurementId: row.measurement_id,
    caseId: row.case_id,
    respondentType: row.respondent_type,
    actor: row.actor,
    perceivedUsefulnessScore: row.perceived_usefulness_score,
    confidenceIncreaseScore: row.confidence_increase_score,
    manualResearchMinutesSaved: row.manual_research_minutes_saved,
    notes: row.notes ?? undefined,
    createdAt: toTimestamp(row.created_at),
  });
}

function mapApproval(row: Record<string, unknown>): Approval {
  return ApprovalSchema.parse({
    approvalId: row.approval_id,
    caseId: row.case_id,
    iterationId: row.iteration_id,
    requestedAction: row.requested_action,
    status: row.status,
    requestedAt: toTimestamp(row.requested_at),
    resolvedAt:
      row.resolved_at === null || row.resolved_at === undefined
        ? undefined
        : toTimestamp(row.resolved_at),
    resolvedBy: row.resolved_by ?? undefined,
    metadata: row.metadata,
  });
}

function mapPromptTemplateVersion(
  row: Record<string, unknown>,
): PromptTemplateVersion {
  return PromptTemplateVersionSchema.parse({
    templateVersionId: row.template_version_id,
    agentName: row.agent_name,
    version: row.version,
    templateBody: row.template_body,
    schemaBody: row.schema_body,
    state: row.is_active ? 'ACTIVE' : 'INACTIVE',
    createdAt: toTimestamp(row.created_at),
  });
}

function toJsonb(value: unknown): string {
  return JSON.stringify(value);
}

function toTimestamp(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
}
