export const TELEGRAM_API_ADAPTER =
  '@venture-advisor-os/telegram-bot/telegram-api-adapter';

export interface TelegramBotApi {
  sendMessage(chatId: number | string, text: string): Promise<void>;
}

export interface TelegramBotApiClientOptions {
  botToken: string;
  fetchImpl?: typeof fetch;
  apiBaseUrl?: string;
}

export function createTelegramBotApiClient(
  options: TelegramBotApiClientOptions,
): TelegramBotApi {
  const fetchImpl = options.fetchImpl ?? fetch;
  const apiBaseUrl = options.apiBaseUrl ?? 'https://api.telegram.org';

  return {
    async sendMessage(chatId, text) {
      const response = await fetchImpl(
        `${apiBaseUrl.replace(/\/$/u, '')}/bot${options.botToken}/sendMessage`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json; charset=utf-8',
          },
          body: JSON.stringify({
            chat_id: chatId,
            text,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(
          `Telegram sendMessage request failed with status ${response.status}.`,
        );
      }
    },
  };
}
