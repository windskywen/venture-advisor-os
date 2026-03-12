ALTER TABLE opportunity_cases
ADD COLUMN IF NOT EXISTS rejection_rationale TEXT,
ADD COLUMN IF NOT EXISTS rejection_category TEXT CHECK (
  rejection_category IS NULL OR rejection_category IN (
    'WEAK_MARKET',
    'WEAK_WILLINGNESS_TO_PAY',
    'WEAK_MOAT',
    'WEAK_GTM',
    'FOUNDER_MISMATCH',
    'EXCESSIVE_REGULATORY_BURDEN',
    'FEATURE_NOT_COMPANY',
    'INSUFFICIENT_EVIDENCE_AFTER_ITERATION_BUDGET'
  )
),
ADD COLUMN IF NOT EXISTS portfolio_escalation_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS opportunity_cases_rejection_category_idx
ON opportunity_cases (rejection_category)
WHERE rejection_category IS NOT NULL;
