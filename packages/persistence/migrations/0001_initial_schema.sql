CREATE OR REPLACE FUNCTION set_updated_at_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS opportunity_cases (
  case_id TEXT PRIMARY KEY,
  topic TEXT NOT NULL,
  region TEXT,
  founder_profile TEXT,
  preferred_business_models JSONB NOT NULL DEFAULT '[]'::jsonb,
  constraints JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL CHECK (
    status IN (
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
      'FAILED'
    )
  ),
  current_iteration INTEGER NOT NULL DEFAULT 0 CHECK (current_iteration >= 0),
  max_iterations INTEGER NOT NULL CHECK (max_iterations > 0),
  final_decision TEXT CHECK (
    final_decision IS NULL OR final_decision IN ('PASS', 'REVISE', 'PIVOT', 'REJECT')
  ),
  failure_category TEXT CHECK (
    failure_category IS NULL OR failure_category IN (
      'INFRA_FAILURE',
      'SCHEMA_VALIDATION_FAILURE',
      'AGENT_TIMEOUT',
      'MALFORMED_OUTPUT',
      'INVALID_AGENT_OUTPUT',
      'NORMALIZATION_FAILURE',
      'STORAGE_FAILURE',
      'JUDGE_DEAD_END'
    )
  ),
  manual_review_required BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER opportunity_cases_set_updated_at
BEFORE UPDATE ON opportunity_cases
FOR EACH ROW
EXECUTE FUNCTION set_updated_at_timestamp();

CREATE TABLE IF NOT EXISTS case_iterations (
  iteration_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES opportunity_cases(case_id) ON DELETE CASCADE,
  iteration_no INTEGER NOT NULL CHECK (iteration_no > 0),
  status_at_start TEXT CHECK (
    status_at_start IS NULL OR status_at_start IN (
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
      'FAILED'
    )
  ),
  status_at_end TEXT CHECK (
    status_at_end IS NULL OR status_at_end IN (
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
      'FAILED'
    )
  ),
  judge_decision TEXT CHECK (
    judge_decision IS NULL OR judge_decision IN ('PASS', 'REVISE', 'PIVOT', 'REJECT')
  ),
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  UNIQUE (case_id, iteration_no)
);

CREATE TABLE IF NOT EXISTS agent_outputs (
  agent_output_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES opportunity_cases(case_id) ON DELETE CASCADE,
  iteration_id TEXT NOT NULL REFERENCES case_iterations(iteration_id) ON DELETE CASCADE,
  iteration_no INTEGER NOT NULL CHECK (iteration_no > 0),
  agent_name TEXT NOT NULL CHECK (
    agent_name IN (
      'FactResearcher',
      'OpportunityStrategist',
      'VCCritic',
      'Judge',
      'PRDStrategist',
      'POCArchitect'
    )
  ),
  raw_output JSONB NOT NULL,
  normalized_output JSONB NOT NULL,
  validation_errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  token_usage JSONB,
  latency_ms INTEGER CHECK (latency_ms IS NULL OR latency_ms >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS judge_tasks (
  task_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES opportunity_cases(case_id) ON DELETE CASCADE,
  iteration_id TEXT NOT NULL REFERENCES case_iterations(iteration_id) ON DELETE CASCADE,
  iteration_no INTEGER NOT NULL CHECK (iteration_no > 0),
  task_type TEXT NOT NULL CHECK (
    task_type IN (
      'FACT_RESEARCH',
      'STRATEGY_REFRAME',
      'EVIDENCE_REFRESH',
      'COMPETITOR_EXPANSION',
      'MONETIZATION_REWORK',
      'ICP_REFOCUS',
      'MVP_RESCOPING',
      'GTM_REWORK',
      'TERMINAL_RISK_CONFIRMATION'
    )
  ),
  target_agent TEXT NOT NULL CHECK (
    target_agent IN ('FACT_RESEARCHER', 'OPPORTUNITY_STRATEGIST')
  ),
  description TEXT NOT NULL,
  blocking BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS score_details (
  score_detail_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES opportunity_cases(case_id) ON DELETE CASCADE,
  iteration_id TEXT NOT NULL REFERENCES case_iterations(iteration_id) ON DELETE CASCADE,
  iteration_no INTEGER NOT NULL CHECK (iteration_no > 0),
  scoring_agent TEXT NOT NULL CHECK (scoring_agent IN ('VCCritic', 'Judge')),
  dimension TEXT NOT NULL,
  score NUMERIC(4, 2) NOT NULL CHECK (score >= 1 AND score <= 10),
  rationale TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  audit_log_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES opportunity_cases(case_id) ON DELETE CASCADE,
  iteration_id TEXT REFERENCES case_iterations(iteration_id) ON DELETE SET NULL,
  iteration_no INTEGER CHECK (iteration_no IS NULL OR iteration_no > 0),
  action TEXT NOT NULL,
  actor TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS approvals (
  approval_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES opportunity_cases(case_id) ON DELETE CASCADE,
  iteration_id TEXT NOT NULL REFERENCES case_iterations(iteration_id) ON DELETE CASCADE,
  requested_action TEXT NOT NULL CHECK (
    requested_action IN (
      'FORCE_REVISE',
      'FORCE_PIVOT',
      'FORCE_PASS_TO_PRD',
      'FORCE_REJECT'
    )
  ),
  status TEXT NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS prompt_template_versions (
  template_version_id TEXT PRIMARY KEY,
  agent_name TEXT NOT NULL CHECK (
    agent_name IN (
      'FactResearcher',
      'OpportunityStrategist',
      'VCCritic',
      'Judge',
      'PRDStrategist',
      'POCArchitect'
    )
  ),
  version TEXT NOT NULL,
  template_body TEXT NOT NULL,
  schema_body JSONB NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (agent_name, version)
);

CREATE UNIQUE INDEX IF NOT EXISTS prompt_template_versions_active_idx
ON prompt_template_versions (agent_name)
WHERE is_active;

CREATE INDEX IF NOT EXISTS opportunity_cases_status_created_at_idx
ON opportunity_cases (status, created_at, case_id);

CREATE INDEX IF NOT EXISTS case_iterations_case_iteration_no_idx
ON case_iterations (case_id, iteration_no);

CREATE INDEX IF NOT EXISTS agent_outputs_case_iteration_agent_idx
ON agent_outputs (case_id, iteration_no, agent_name);

CREATE INDEX IF NOT EXISTS judge_tasks_case_iteration_target_idx
ON judge_tasks (case_id, iteration_no, target_agent);

CREATE INDEX IF NOT EXISTS score_details_case_iteration_agent_idx
ON score_details (case_id, iteration_no, scoring_agent);

CREATE INDEX IF NOT EXISTS audit_logs_case_created_at_idx
ON audit_logs (case_id, created_at);

CREATE INDEX IF NOT EXISTS approvals_case_requested_at_idx
ON approvals (case_id, requested_at);
