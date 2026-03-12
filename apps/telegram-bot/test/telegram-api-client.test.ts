import { createServer } from 'node:http';

import { afterEach, describe, expect, it } from 'vitest';

import { listenOnSafePort } from '../../../tests/support/http-server.js';

import { createTelegramBotApiClient } from '../src/index.js';

describe('telegram bot api client', () => {
  const servers: ReturnType<typeof createServer>[] = [];

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

  it('posts sendMessage calls to the Telegram Bot API', async () => {
    const observedRequests: Array<Record<string, unknown>> = [];
    const server = createServer(async (request, response) => {
      const chunks: Buffer[] = [];
      for await (const chunk of request) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }

      observedRequests.push({
        method: request.method,
        url: request.url,
        contentType: request.headers['content-type'],
        body: Buffer.concat(chunks).toString('utf8'),
      });

      response.statusCode = 200;
      response.setHeader('content-type', 'application/json; charset=utf-8');
      response.end(JSON.stringify({ ok: true, result: {} }));
    });
    servers.push(server);
    const baseUrl = await listenOnSafePort(server);

    const client = createTelegramBotApiClient({
      botToken: 'bot-token-123',
      apiBaseUrl: baseUrl,
    });

    await client.sendMessage(123456, 'Workflow queued.');

    expect(observedRequests).toEqual([
      {
        method: 'POST',
        url: '/botbot-token-123/sendMessage',
        contentType: 'application/json; charset=utf-8',
        body: JSON.stringify({
          chat_id: 123456,
          text: 'Workflow queued.',
        }),
      },
    ]);
  });
});
