import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import type { TelegramBotGatewayApi } from '../src/index.js';
import {
  createTelegramBotApp,
  createTelegramCommandHandler,
} from '../src/index.js';

const TELEGRAM_SOURCE_FILES = [
  join(process.cwd(), 'apps/telegram-bot/src/app/index.ts'),
  join(process.cwd(), 'apps/telegram-bot/src/adapters/command-handler.ts'),
  join(process.cwd(), 'apps/telegram-bot/src/adapters/gateway-api.ts'),
  join(process.cwd(), 'apps/telegram-bot/src/adapters/telegram-api.ts'),
  join(process.cwd(), 'apps/telegram-bot/src/adapters/webhook-runner.ts'),
];

describe('telegram security boundaries', () => {
  it('does not import shell execution or filesystem mutation APIs in command paths', () => {
    for (const filePath of TELEGRAM_SOURCE_FILES) {
      const source = readFileSync(filePath, 'utf8');

      expect(source).not.toMatch(/node:child_process/u);
      expect(source).not.toMatch(/exec(File)?\(/u);
      expect(source).not.toMatch(/spawn\(/u);
      expect(source).not.toMatch(/fork\(/u);
      expect(source).not.toMatch(/node:fs\/promises/u);
      expect(source).not.toMatch(/writeFile/u);
    }
  });

  it.each([
    ['/startcase ../../secret', false, 'Usage: /startcase {caseId}'],
    ['/status ../../secret', false, 'Usage: /status {caseId}'],
    [
      '/approve ../../secret FORCE_PASS_TO_PRD',
      true,
      'Usage: /approve {caseId} {FORCE_REVISE|FORCE_PIVOT|FORCE_PASS_TO_PRD}',
    ],
    ['/reject ../../secret', true, 'Usage: /reject {caseId}'],
    ['/prd ../../secret', false, 'Usage: /prd {caseId}'],
    ['/poc ../../secret', false, 'Usage: /poc {caseId}'],
  ])(
    'rejects path-like case identifiers for %s',
    async (text, isOperator, expectedText) => {
      const handler = createTelegramCommandHandler(
        createTelegramBotApp({
          gatewayApi: createGatewayApiStub(),
        }),
      );

      const response = await handler.handle({
        text,
        isOperator,
      });

      expect(response).toEqual({
        handled: true,
        text: expectedText,
      });
    },
  );

  it.each([
    '/exec whoami',
    '/shell dir',
    '/cmd type .env',
    '/commit checkpoint',
    '/push origin main',
    '/deploy production',
  ])('blocks shell-style Telegram commands: %s', async (text) => {
    const handler = createTelegramCommandHandler(
      createTelegramBotApp({
        gatewayApi: createGatewayApiStub(),
      }),
    );

    const response = await handler.handle({
      text,
      isOperator: true,
    });

    expect(response).toEqual({
      handled: true,
      text: 'MVP permissions are limited to L0 and L1. Local command, git, and deploy actions are disabled.',
    });
  });
});

function createGatewayApiStub(
  overrides: Partial<TelegramBotGatewayApi> = {},
): TelegramBotGatewayApi {
  return {
    async createCase() {
      throw new Error('createCase should not be called in this test');
    },
    async startCase() {
      throw new Error('startCase should not be called in this test');
    },
    async getCase() {
      throw new Error('getCase should not be called in this test');
    },
    async getCaseOutputs() {
      throw new Error('getCaseOutputs should not be called in this test');
    },
    async approveCase() {
      throw new Error('approveCase should not be called in this test');
    },
    async rejectCase() {
      throw new Error('rejectCase should not be called in this test');
    },
    async generatePrd() {
      throw new Error('generatePrd should not be called in this test');
    },
    async generatePoc() {
      throw new Error('generatePoc should not be called in this test');
    },
    async getNextTopic() {
      throw new Error('getNextTopic should not be called in this test');
    },
    async getPortfolio() {
      throw new Error('getPortfolio should not be called in this test');
    },
    ...overrides,
  };
}
