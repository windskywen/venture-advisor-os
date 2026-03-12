import type {
  ApproveCaseActionDto,
  CaseSummaryDto,
  CaseActionResponseDto,
  CreateCaseRequestDto,
  CreateCaseResponseDto,
  GetCaseOutputsResponseDto,
  NextTopicResponseDto,
  PortfolioOverviewDto,
  StartCaseResponseDto,
} from '@venture-advisor-os/shared-types';

import type { TelegramBotGatewayApi } from '../app/index.js';

export const TELEGRAM_GATEWAY_API_ADAPTER =
  '@venture-advisor-os/telegram-bot/gateway-api-adapter';

export interface TelegramGatewayApiClientOptions {
  baseUrl: string;
  authToken?: string;
  fetchImpl?: typeof fetch;
}

export function createTelegramGatewayApiClient(
  options: TelegramGatewayApiClientOptions,
): TelegramBotGatewayApi {
  const fetchImpl = options.fetchImpl ?? fetch;

  return {
    async createCase(request: CreateCaseRequestDto): Promise<CreateCaseResponseDto> {
      const response = await fetchImpl(buildUrl(options.baseUrl, '/api/cases'), {
        method: 'POST',
        headers: buildHeaders(options.authToken),
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(
          `Gateway API create case request failed with status ${response.status}.`,
        );
      }

      return (await response.json()) as CreateCaseResponseDto;
    },
    async startCase(caseId: string): Promise<StartCaseResponseDto> {
      const response = await fetchImpl(
        buildUrl(
          options.baseUrl,
          `/api/cases/${encodeURIComponent(caseId)}/start`,
        ),
        {
          method: 'POST',
          headers: buildHeaders(options.authToken),
        },
      );

      if (!response.ok) {
        throw new Error(
          `Gateway API start case request failed with status ${response.status}.`,
        );
      }

      return (await response.json()) as StartCaseResponseDto;
    },
    async getCase(caseId: string): Promise<CaseSummaryDto> {
      const response = await fetchImpl(
        buildUrl(options.baseUrl, `/api/cases/${encodeURIComponent(caseId)}`),
        {
          method: 'GET',
          headers: buildHeaders(options.authToken),
        },
      );

      if (!response.ok) {
        throw new Error(
          `Gateway API get case request failed with status ${response.status}.`,
        );
      }

      return (await response.json()) as CaseSummaryDto;
    },
    async getCaseOutputs(caseId: string): Promise<GetCaseOutputsResponseDto> {
      const response = await fetchImpl(
        buildUrl(
          options.baseUrl,
          `/api/cases/${encodeURIComponent(caseId)}/outputs`,
        ),
        {
          method: 'GET',
          headers: buildHeaders(options.authToken),
        },
      );

      if (!response.ok) {
        throw new Error(
          `Gateway API get case outputs request failed with status ${response.status}.`,
        );
      }

      return (await response.json()) as GetCaseOutputsResponseDto;
    },
    async approveCase(
      caseId: string,
      action: ApproveCaseActionDto,
    ): Promise<CaseActionResponseDto> {
      const response = await fetchImpl(
        buildUrl(
          options.baseUrl,
          `/api/cases/${encodeURIComponent(caseId)}/approve`,
        ),
        {
          method: 'POST',
          headers: buildHeaders(options.authToken),
          body: JSON.stringify({
            action,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(
          `Gateway API approve case request failed with status ${response.status}.`,
        );
      }

      return (await response.json()) as CaseActionResponseDto;
    },
    async rejectCase(caseId: string): Promise<CaseActionResponseDto> {
      const response = await fetchImpl(
        buildUrl(
          options.baseUrl,
          `/api/cases/${encodeURIComponent(caseId)}/reject`,
        ),
        {
          method: 'POST',
          headers: buildHeaders(options.authToken),
          body: JSON.stringify({}),
        },
      );

      if (!response.ok) {
        throw new Error(
          `Gateway API reject case request failed with status ${response.status}.`,
        );
      }

      return (await response.json()) as CaseActionResponseDto;
    },
    async generatePrd(caseId: string): Promise<CaseActionResponseDto> {
      const response = await fetchImpl(
        buildUrl(
          options.baseUrl,
          `/api/cases/${encodeURIComponent(caseId)}/generate-prd`,
        ),
        {
          method: 'POST',
          headers: buildHeaders(options.authToken),
          body: JSON.stringify({}),
        },
      );

      if (!response.ok) {
        throw new Error(
          `Gateway API generate PRD request failed with status ${response.status}.`,
        );
      }

      return (await response.json()) as CaseActionResponseDto;
    },
    async generatePoc(caseId: string): Promise<CaseActionResponseDto> {
      const response = await fetchImpl(
        buildUrl(
          options.baseUrl,
          `/api/cases/${encodeURIComponent(caseId)}/generate-poc`,
        ),
        {
          method: 'POST',
          headers: buildHeaders(options.authToken),
          body: JSON.stringify({}),
        },
      );

      if (!response.ok) {
        throw new Error(
          `Gateway API generate POC request failed with status ${response.status}.`,
        );
      }

      return (await response.json()) as CaseActionResponseDto;
    },
    async getNextTopic(): Promise<NextTopicResponseDto> {
      const response = await fetchImpl(
        buildUrl(options.baseUrl, '/api/cases/next-topic'),
        {
          method: 'GET',
          headers: buildHeaders(options.authToken),
        },
      );

      if (!response.ok) {
        throw new Error(
          `Gateway API next-topic request failed with status ${response.status}.`,
        );
      }

      return (await response.json()) as NextTopicResponseDto;
    },
    async getPortfolio(limit?: number): Promise<PortfolioOverviewDto> {
      const query = limit === undefined ? '' : `?limit=${encodeURIComponent(String(limit))}`;
      const response = await fetchImpl(
        buildUrl(options.baseUrl, `/api/cases/portfolio${query}`),
        {
          method: 'GET',
          headers: buildHeaders(options.authToken),
        },
      );

      if (!response.ok) {
        throw new Error(
          `Gateway API portfolio request failed with status ${response.status}.`,
        );
      }

      return (await response.json()) as PortfolioOverviewDto;
    },
  };
}

function buildUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/$/u, '')}${path}`;
}

function buildHeaders(authToken?: string): Record<string, string> {
  return {
    ...(authToken ? { authorization: `Bearer ${authToken}` } : {}),
    'content-type': 'application/json; charset=utf-8',
  };
}
