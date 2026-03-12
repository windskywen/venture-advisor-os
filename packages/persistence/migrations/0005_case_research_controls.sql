ALTER TABLE opportunity_cases
ADD COLUMN IF NOT EXISTS research_style TEXT;

ALTER TABLE opportunity_cases
ADD COLUMN IF NOT EXISTS browsing_autonomy JSONB NOT NULL DEFAULT
  '{"profile":"STANDARD","allowAdjacentExploration":false,"allowCompetitorExploration":true,"allowOpenEndedQueries":false,"maxSources":5,"recencyWindowDays":120}'::jsonb;

ALTER TABLE opportunity_cases
DROP CONSTRAINT IF EXISTS opportunity_cases_research_style_check;

ALTER TABLE opportunity_cases
ADD CONSTRAINT opportunity_cases_research_style_check CHECK (
  research_style IS NULL OR research_style IN (
    'BALANCED',
    'CUSTOMER_WORKFLOW',
    'COMPETITOR_INTENSIVE',
    'REGULATORY_RISK',
    'MARKET_TIMING'
  )
);
