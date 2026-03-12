import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import { ZodError, z } from 'zod';

import { TELEGRAM_BOT_APP_LAYER } from '../app/index.js';
import type { TelegramCommandHandler } from './command-handler.js';
import type { TelegramBotApi } from './telegram-api.js';

export const TELEGRAM_WEBHOOK_ADAPTER =
  `${TELEGRAM_BOT_APP_LAYER}/webhook-adapter`;

export interface TelegramWebhookServerOptions {
  commandHandler: TelegramCommandHandler;
  botApi: TelegramBotApi;
  webhookSecret: string;
  path?: string;
  operatorUserIds?: Array<number | string>;
}

const TelegramIdSchema = z.union([z.number(), z.string().trim().min(1)]);
const TelegramUpdateSchema = z.object({
  message: z
    .object({
      text: z.string().trim().min(1).optional(),
      chat: z
        .object({
          id: TelegramIdSchema,
        })
        .optional(),
      from: z
        .object({
          id: TelegramIdSchema,
        })
        .optional(),
    })
    .optional(),
});

class InvalidTelegramWebhookBodyError extends Error {}

export function createTelegramWebhookServer(
  options: TelegramWebhookServerOptions,
): Server {
  const webhookPath = options.path ?? '/telegram/webhook';
  const operatorUserIds = new Set(
    (options.operatorUserIds ?? []).map((value) => String(value)),
  );

  return createServer(async (request, response) => {
    try {
      if (request.method !== 'POST' || request.url !== webhookPath) {
        writeJson(response, 404, {
          error: 'NOT_FOUND',
        });
        return;
      }

      const secretToken = request.headers['x-telegram-bot-api-secret-token'];
      if (secretToken !== options.webhookSecret) {
        writeJson(response, 401, {
          error: 'UNAUTHORIZED',
        });
        return;
      }

      const update = TelegramUpdateSchema.parse(await readJsonBody(request));
      const messageText = update.message?.text;
      const chatId = update.message?.chat?.id;
      const userId = update.message?.from?.id;

      if (
        typeof messageText === 'string' &&
        messageText.trim().length > 0 &&
        chatId !== undefined
      ) {
        const commandResponse = await options.commandHandler.handle({
          text: messageText,
          isOperator:
            userId !== undefined && operatorUserIds.has(String(userId)),
        });

        if (commandResponse.handled && commandResponse.text) {
          await options.botApi.sendMessage(chatId, commandResponse.text);
        }
      }

      writeJson(response, 200, {
        ok: true,
      });
    } catch (error) {
      if (
        error instanceof InvalidTelegramWebhookBodyError ||
        error instanceof ZodError
      ) {
        writeJson(response, 400, {
          error: 'INVALID_PAYLOAD',
          message: error.message,
        });
        return;
      }

      writeJson(response, 500, {
        error: 'INTERNAL_SERVER_ERROR',
        message: error instanceof Error ? error.message : 'Unknown error.',
      });
    }
  });
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const body = Buffer.concat(chunks).toString('utf8').trim();
  if (body.length === 0) {
    return {};
  }

  try {
    return JSON.parse(body);
  } catch {
    throw new InvalidTelegramWebhookBodyError(
      'Webhook body must be valid JSON.',
    );
  }
}

function writeJson(
  response: ServerResponse,
  statusCode: number,
  payload: unknown,
): void {
  response.statusCode = statusCode;
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(payload));
}
