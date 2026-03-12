CREATE TABLE IF NOT EXISTS founder_value_measurements (
  measurement_id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES opportunity_cases(case_id) ON DELETE CASCADE,
  respondent_type TEXT NOT NULL CHECK (respondent_type IN ('OPERATOR', 'FOUNDER')),
  actor TEXT NOT NULL,
  perceived_usefulness_score INTEGER NOT NULL CHECK (
    perceived_usefulness_score >= 1 AND perceived_usefulness_score <= 5
  ),
  confidence_increase_score INTEGER NOT NULL CHECK (
    confidence_increase_score >= 1 AND confidence_increase_score <= 5
  ),
  manual_research_minutes_saved INTEGER NOT NULL CHECK (
    manual_research_minutes_saved >= 0
  ),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS founder_value_measurements_case_created_at_idx
ON founder_value_measurements (case_id, created_at);
