ALTER TABLE opportunity_cases
ADD COLUMN IF NOT EXISTS approved_source_iteration_id TEXT,
ADD COLUMN IF NOT EXISTS approved_source_iteration_no INTEGER CHECK (
  approved_source_iteration_no IS NULL OR approved_source_iteration_no > 0
);

CREATE INDEX IF NOT EXISTS opportunity_cases_approved_source_iteration_idx
ON opportunity_cases (approved_source_iteration_no)
WHERE approved_source_iteration_no IS NOT NULL;
