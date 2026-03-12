import { afterEach, describe, expect, it } from 'vitest';

import { listenOnSafePort } from '../../../tests/support/http-server.js';

import {
  createTelegramWebhookServer,
  type TelegramCommandHandler,
} from '../src/index.js';

describe('telegram webhook runner', () => {
  const servers: Array<ReturnType<typeof createTelegramWebhookServer>> = [];

  afterEach(async () => {
    await Promise.all(
      servers.splice(0).map(
        (server) =>
          new Promise<void>((resolve, reject) => {
            server.close((error) => {
              if (error) {
                reject(error);
                return;
              }

              resolve();
            });
          }),
      ),
    );
  });

  it('validates the webhook secret and relays handled commands back to Telegram', async () => {
    const observedRequests: Array<Record<string, unknown>> = [];
    const sentMessages: Array<Record<string, unknown>> = [];
    const commandHandler: TelegramCommandHandler = {
      async handle(request) {
        observedRequests.push(request);
        return {
          handled: true,
          text: 'Approved.',
        };
      },
    };
    const server = createTelegramWebhookServer({
      commandHandler,
      botApi: {
        async sendMessage(chatId, text) {
          sentMessages.push({
            chatId,
            text,
          });
        },
      },
      webhookSecret: 'secret-token',
      operatorUserIds: ['42'],
    });
    servers.push(server);
    const baseUrl = await listenOnSafePort(server);

    const response = await fetch(`${baseUrl}/telegram/webhook`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-telegram-bot-api-secret-token': 'secret-token',
      },
      body: JSON.stringify({
        message: {
          text: '/approve case-1 FORCE_PASS_TO_PRD',
          chat: {
            id: 1001,
          },
          from: {
            id: 42,
          },
        },
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
    });
    expect(observedRequests).toEqual([
      {
        text: '/approve case-1 FORCE_PASS_TO_PRD',
        isOperator: true,
      },
    ]);
    expect(sentMessages).toEqual([
      {
        chatId: 1001,
        text: 'Approved.',
      },
    ]);
  });

  it('rejects webhook requests with an invalid secret token', async () => {
    let handled = false;
    const server = createTelegramWebhookServer({
      commandHandler: {
        async handle() {
          handled = true;
          return {
            handled: true,
            text: 'Should not run.',
          };
        },
      },
      botApi: {
        async sendMessage() {
          throw new Error('sendMessage should not be called for invalid secrets');
        },
      },
      webhookSecret: 'secret-token',
    });
    servers.push(server);
    const baseUrl = await listenOnSafePort(server);

    const response = await fetch(`${baseUrl}/telegram/webhook`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-telegram-bot-api-secret-token': 'wrong-secret',
      },
      body: JSON.stringify({
        message: {
          text: '/status case-1',
          chat: {
            id: 1001,
          },
        },
      }),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: 'UNAUTHORIZED',
    });
    expect(handled).toBe(false);
  });

  it('returns 400 for malformed Telegram webhook JSON payloads', async () => {
    let handled = false;
    const server = createTelegramWebhookServer({
      commandHandler: {
        async handle() {
          handled = true;
          return {
            handled: true,
            text: 'Should not run.',
          };
        },
      },
      botApi: {
        async sendMessage() {
          throw new Error('sendMessage should not be called for invalid payloads');
        },
      },
      webhookSecret: 'secret-token',
    });
    servers.push(server);
    const baseUrl = await listenOnSafePort(server);

    const response = await fetch(`${baseUrl}/telegram/webhook`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-telegram-bot-api-secret-token': 'secret-token',
      },
      body: '{"message":',
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'INVALID_PAYLOAD',
      message: 'Webhook body must be valid JSON.',
    });
    expect(handled).toBe(false);
  });

  it('returns 400 for structurally invalid Telegram webhook payloads', async () => {
    let handled = false;
    const server = createTelegramWebhookServer({
      commandHandler: {
        async handle() {
          handled = true;
          return {
            handled: true,
            text: 'Should not run.',
          };
        },
      },
      botApi: {
        async sendMessage() {
          throw new Error('sendMessage should not be called for invalid payloads');
        },
      },
      webhookSecret: 'secret-token',
    });
    servers.push(server);
    const baseUrl = await listenOnSafePort(server);

    const response = await fetch(`${baseUrl}/telegram/webhook`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-telegram-bot-api-secret-token': 'secret-token',
      },
      body: JSON.stringify({
        message: {
          text: '/status case-1',
          chat: {
            id: {
              raw: 1001,
            },
          },
        },
      }),
    });

    expect(response.status).toBe(400);
    expect(handled).toBe(false);
  });
});
