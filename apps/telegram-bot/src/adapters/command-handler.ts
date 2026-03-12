import {
  MVP_PERMISSION_ERROR_MESSAGE,
  isMvpTelegramCommandDisabled,
} from '@venture-advisor-os/shared-types';

import {
  TELEGRAM_BOT_APP_LAYER,
  TelegramBotCommandError,
  type TelegramBotApp,
} from '../app/index.js';

export const TELEGRAM_COMMAND_ADAPTER = `${TELEGRAM_BOT_APP_LAYER}/command-adapter`;

export interface TelegramCommandRequest {
  text: string;
  isOperator?: boolean;
}

export interface TelegramCommandResponse {
  handled: boolean;
  text?: string;
}

export interface TelegramCommandHandler {
  handle(request: TelegramCommandRequest): Promise<TelegramCommandResponse>;
}

export function createTelegramCommandHandler(
  app: TelegramBotApp,
): TelegramCommandHandler {
  return {
    async handle(request) {
      const trimmedText = request.text.trim();
      if (trimmedText.length === 0 || !trimmedText.startsWith('/')) {
        return {
          handled: false,
        };
      }

      const [commandToken, ...argumentTokens] = trimmedText.split(/\s+/u);
      const command = normalizeCommandToken(commandToken);

      try {
        if (isMvpTelegramCommandDisabled(command)) {
          return {
            handled: true,
            text: MVP_PERMISSION_ERROR_MESSAGE,
          };
        }

        if (command === '/newidea') {
          return {
            handled: true,
            text: await app.createIdea(argumentTokens.join(' ')),
          };
        }

        if (command === '/startcase') {
          return {
            handled: true,
            text: await app.startCase(argumentTokens.join(' ')),
          };
        }

        if (command === '/status') {
          return {
            handled: true,
            text: await app.getCaseStatus(argumentTokens.join(' ')),
          };
        }

        if (command === '/approve') {
          if (!request.isOperator) {
            return {
              handled: true,
              text: 'Operator access required for /approve.',
            };
          }

          return {
            handled: true,
            text: await app.approveCase(
              argumentTokens[0] ?? '',
              argumentTokens[1] ?? '',
            ),
          };
        }

        if (command === '/reject') {
          if (!request.isOperator) {
            return {
              handled: true,
              text: 'Operator access required for /reject.',
            };
          }

          return {
            handled: true,
            text: await app.rejectCase(argumentTokens[0] ?? ''),
          };
        }

        if (command === '/prd') {
          return {
            handled: true,
            text: await app.requestPrd(argumentTokens[0] ?? ''),
          };
        }

        if (command === '/poc') {
          return {
            handled: true,
            text: await app.requestPoc(argumentTokens[0] ?? ''),
          };
        }

        if (command === '/next-topic') {
          return {
            handled: true,
            text: await app.getNextTopic(),
          };
        }

        if (command === '/portfolio') {
          return {
            handled: true,
            text: await app.getPortfolio(argumentTokens[0]),
          };
        }
      } catch (error) {
        if (error instanceof TelegramBotCommandError) {
          return {
            handled: true,
            text: error.message,
          };
        }

        throw error;
      }

      return {
        handled: true,
        text: 'Unsupported command. Telegram is limited to workflow control commands.',
      };
    },
  };
}

function normalizeCommandToken(commandToken: string): string {
  const botMentionIndex = commandToken.indexOf('@');
  if (botMentionIndex === -1) {
    return commandToken;
  }

  return commandToken.slice(0, botMentionIndex);
}
