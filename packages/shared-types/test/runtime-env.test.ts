import { describe, expect, it } from 'vitest';

import {
  loadGatewayApiRuntimeEnvironment,
  loadTelegramBotRuntimeEnvironment,
  loadWorkerRuntimeEnvironment,
} from '../src/index.js';

describe('runtime environment validation', () => {
  it('loads gateway runtime configuration and validates timeout thresholds', () => {
    const config = loadGatewayApiRuntimeEnvironment({
      DATABASE_URL: 'postgres://postgres:postgres@localhost:5432/ventrueadvisor',
      REDIS_URL: 'redis://localhost:6379',
      STORAGE_ROOT: './storage',
      API_PORT: '3000',
      JUDGE_VC_PASS_THRESHOLD: '8.1',
      JUDGE_EVIDENCE_PASS_THRESHOLD: '7.4',
      DEFAULT_RESEARCH_STYLE: 'COMPETITOR_INTENSIVE',
      BROWSING_AUTONOMY_PROFILE: 'EXPANDED',
      BROWSING_ALLOW_ADJACENT_EXPLORATION: 'true',
      BROWSING_ALLOW_OPEN_ENDED_QUERIES: 'true',
      BROWSING_MAX_SOURCES_PER_QUERY: '9',
      BROWSING_RECENCY_WINDOW_DAYS: '365',
      AGENT_TIMEOUT_MS: '300000',
      REPORT_RENDER_TIMEOUT_MS: '60000',
      PRD_GENERATION_TIMEOUT_MS: '120000',
      POC_GENERATION_TIMEOUT_MS: '120000',
    });

    expect(config.apiPort).toBe(3000);
    expect(config.workflowConfig.timeoutBudgets.agentRunMs).toBe(300000);
    expect(config.workflowConfig.judgeThresholds).toEqual({
      vcPass: 8.1,
      evidencePass: 7.4,
    });
    expect(config.workflowConfig.research.defaultStyle).toBe(
      'COMPETITOR_INTENSIVE',
    );
    expect(config.workflowConfig.browsingAutonomy).toMatchObject({
      defaultProfile: 'EXPANDED',
      allowAdjacentExploration: true,
      allowOpenEndedQueries: true,
      maxSourcesPerQuery: 9,
      recencyWindowDays: 365,
    });
  });

  it('rejects placeholder Telegram secrets', () => {
    expect(() =>
      loadTelegramBotRuntimeEnvironment({
        TELEGRAM_BOT_TOKEN: 'replace-me',
        TELEGRAM_WEBHOOK_SECRET: 'replace-me',
      }),
    ).toThrow('non-placeholder value');
  });

  it('requires worker storage and copilot runtime configuration', () => {
    expect(() =>
      loadWorkerRuntimeEnvironment({
        DATABASE_URL: 'postgres://postgres:postgres@localhost:5432/ventrueadvisor',
        REDIS_URL: 'redis://localhost:6379',
        STORAGE_ROOT: './storage',
        COPILOT_RUNTIME_PATH: '',
      }),
    ).toThrow('Too small');
  });
});
