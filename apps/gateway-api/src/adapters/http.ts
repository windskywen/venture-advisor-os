import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import { randomUUID } from 'node:crypto';

import type { CreateCaseRequestDto } from '@venture-advisor-os/shared-types';
import {
  type StructuredLogger,
  createNoopStructuredLogger,
  runWithStructuredLogContext,
} from '@venture-advisor-os/shared-types';
import { ZodError } from 'zod';

import {
  GatewayApiAppError,
  GATEWAY_API_APP_LAYER,
  type GatewayApiApp,
} from '../app/index.js';

export const GATEWAY_API_HTTP_ADAPTER = `${GATEWAY_API_APP_LAYER}/http-adapter`;
class InvalidJsonBodyError extends Error {}

export interface GatewayApiHttpServerOptions {
  authToken?: string;
  idempotencyStore?: GatewayApiIdempotencyStore;
  operational?: GatewayApiOperationalOptions;
  logger?: StructuredLogger;
}

export interface GatewayApiIdempotencyRecord {
  statusCode: number;
  payload: unknown;
  requestId: string;
}

export interface GatewayApiIdempotencyStore {
  get(key: string): GatewayApiIdempotencyRecord | undefined;
  set(key: string, value: GatewayApiIdempotencyRecord): void;
}

export type GatewayApiDependencyName =
  | 'database'
  | 'queue'
  | 'worker'
  | 'storage';

export interface GatewayApiDependencyReadiness {
  ready: boolean;
  detail?: string;
}

export interface GatewayApiOperationalHealthPayload {
  status: 'ok' | 'degraded';
  generatedAt: string;
  checks: Record<GatewayApiDependencyName, GatewayApiDependencyReadiness>;
}

export interface GatewayApiOperationalOptions {
  checks?: Partial<
    Record<
      GatewayApiDependencyName,
      () =>
        | GatewayApiDependencyReadiness
        | Promise<GatewayApiDependencyReadiness>
    >
  >;
  collectMetrics?: () => Record<string, number> | Promise<Record<string, number>>;
  now?: () => Date;
}

export function createInMemoryGatewayApiIdempotencyStore(): GatewayApiIdempotencyStore {
  const store = new Map<string, GatewayApiIdempotencyRecord>();

  return {
    get(key) {
      return store.get(key);
    },
    set(key, value) {
      store.set(key, value);
    },
  };
}

interface JsonRouteResult {
  statusCode: number;
  payload: unknown;
}

interface RouteResponse {
  statusCode: number;
  contentType: string;
  body: string;
}

export function createGatewayApiHttpServer(
  app: GatewayApiApp,
  options: GatewayApiHttpServerOptions = {},
): Server {
  const logger = options.logger ?? createNoopStructuredLogger();

  return createServer(async (request, response) => {
    const requestId = resolveRequestId(request);
    const requestContext = resolveRequestLogContext(request, requestId);
    const requestLogger = logger.child(requestContext);
    response.setHeader('x-request-id', requestId);

    return runWithStructuredLogContext(requestContext, async () => {
      try {
        const operationalResult = await routeOperationalRequest(request, options);
        if (operationalResult) {
          writeResponse(response, operationalResult);
          return;
        }

        if (!isAuthorized(request, options.authToken)) {
          writeJson(response, 401, {
            error: 'UNAUTHORIZED',
          });
          return;
        }

        const dashboardResult = await routeDashboardRequest(app, request);
        if (dashboardResult) {
          writeResponse(response, dashboardResult);
          return;
        }

        const idempotencyKey = resolveIdempotencyKey(request);
        if (
          idempotencyKey &&
          options.idempotencyStore !== undefined &&
          isIdempotentCandidate(request)
        ) {
          const existing = options.idempotencyStore.get(idempotencyKey);
          if (existing) {
            response.setHeader('x-request-id', existing.requestId);
            writeJson(response, existing.statusCode, existing.payload);
            return;
          }
        }

        const result = await routeRequest(app, request);
        if (
          idempotencyKey &&
          options.idempotencyStore !== undefined &&
          isIdempotentCandidate(request)
        ) {
          options.idempotencyStore.set(idempotencyKey, {
            statusCode: result.statusCode,
            payload: result.payload,
            requestId,
          });
        }

        writeJson(response, result.statusCode, result.payload);
      } catch (error) {
        if (error instanceof InvalidJsonBodyError) {
          requestLogger.warn('http.request.invalid_json', error.message, {
            method: request.method,
            url: request.url,
          });
          writeJson(response, 400, {
            error: 'INVALID_JSON',
            message: error.message,
          });
          return;
        }

        if (error instanceof GatewayApiAppError) {
          requestLogger.error('http.request.app_error', error.message, {
            method: request.method,
            url: request.url,
            statusCode: error.statusCode,
          });
          writeJson(response, error.statusCode, {
            error: 'APP_ERROR',
            message: error.message,
          });
          return;
        }

        if (error instanceof ZodError) {
          requestLogger.warn(
            'http.request.validation_error',
            'Request validation failed.',
            {
              method: request.method,
              url: request.url,
              issueCount: error.issues.length,
            },
          );
          writeJson(response, 400, {
            error: 'VALIDATION_ERROR',
            details: error.issues.map((issue) => issue.message),
          });
          return;
        }

        requestLogger.error(
          'http.request.unhandled_error',
          error instanceof Error ? error.message : 'Unhandled request error.',
          {
            method: request.method,
            url: request.url,
          },
        );
        writeJson(response, 500, {
          error: 'INTERNAL_SERVER_ERROR',
        });
      }
    });
  });
}

async function routeRequest(
  app: GatewayApiApp,
  request: IncomingMessage,
): Promise<JsonRouteResult> {
  const parsedUrl = request.url
    ? new URL(request.url, 'http://localhost')
    : null;

  if (request.method === 'POST' && request.url === '/api/cases') {
    const body = await readJsonBody(request);
    const result = await app.createCase(body as CreateCaseRequestDto);
    return {
      statusCode: 201,
      payload: result,
    };
  }

  const startCaseMatch = request.url?.match(/^\/api\/cases\/([^/]+)\/start$/u);
  if (request.method === 'POST' && startCaseMatch?.[1]) {
    const result = await app.startCase(startCaseMatch[1]);
    return {
      statusCode: 202,
      payload: result,
    };
  }

  if (request.method === 'GET' && request.url === '/api/cases/next-topic') {
    const result = await app.getNextTopic();
    return {
      statusCode: 200,
      payload: result,
    };
  }

  if (request.method === 'GET' && request.url === '/api/runtime/model') {
    const result = await app.getRuntimeModel();
    return {
      statusCode: 200,
      payload: result,
    };
  }

  if (request.method === 'PUT' && request.url === '/api/runtime/model') {
    const body = await readJsonBody(request);
    const result = await app.updateRuntimeModel(
      body as import('@venture-advisor-os/shared-types').UpdateRuntimeModelRequestDto,
    );
    return {
      statusCode: 200,
      payload: result,
    };
  }

  if (request.method === 'GET' && parsedUrl?.pathname === '/api/cases/portfolio') {
    const limitParam = parsedUrl.searchParams.get('limit');
    const result = await app.getPortfolio(
      limitParam === null ? undefined : Number(limitParam),
    );
    return {
      statusCode: 200,
      payload: result,
    };
  }

  if (request.method === 'GET' && request.url === '/api/reports/metrics') {
    const result = await app.getOperatorMetricsReport();
    return {
      statusCode: 200,
      payload: result,
    };
  }

  if (request.method === 'GET' && request.url === '/api/reports/opportunities') {
    const result = await app.getOpportunityRankingReport();
    return {
      statusCode: 200,
      payload: result,
    };
  }

  const getCaseMatch = request.url?.match(/^\/api\/cases\/([^/]+)$/u);
  if (request.method === 'GET' && getCaseMatch?.[1]) {
    const result = await app.getCase(getCaseMatch[1]);
    return {
      statusCode: 200,
      payload: result,
    };
  }

  const getIterationsMatch = request.url?.match(
    /^\/api\/cases\/([^/]+)\/iterations$/u,
  );
  if (request.method === 'GET' && getIterationsMatch?.[1]) {
    const result = await app.getCaseIterations(getIterationsMatch[1]);
    return {
      statusCode: 200,
      payload: result,
    };
  }

  const getOutputsMatch = request.url?.match(/^\/api\/cases\/([^/]+)\/outputs$/u);
  if (request.method === 'GET' && getOutputsMatch?.[1]) {
    const result = await app.getCaseOutputs(getOutputsMatch[1]);
    return {
      statusCode: 200,
      payload: result,
    };
  }

  const approveCaseMatch = request.url?.match(/^\/api\/cases\/([^/]+)\/approve$/u);
  if (request.method === 'POST' && approveCaseMatch?.[1]) {
    const body = await readJsonBody(request);
    const result = await app.approveCase(
      approveCaseMatch[1],
      body as import('@venture-advisor-os/shared-types').ApproveCaseRequestDto,
    );
    return {
      statusCode: 202,
      payload: result,
    };
  }

  const rejectCaseMatch = request.url?.match(/^\/api\/cases\/([^/]+)\/reject$/u);
  if (request.method === 'POST' && rejectCaseMatch?.[1]) {
    const body = await readJsonBody(request);
    const result = await app.rejectCase(
      rejectCaseMatch[1],
      body as import('@venture-advisor-os/shared-types').RejectCaseRequestDto,
    );
    return {
      statusCode: 202,
      payload: result,
    };
  }

  const founderValueMatch = request.url?.match(
    /^\/api\/cases\/([^/]+)\/founder-value$/u,
  );
  if (request.method === 'POST' && founderValueMatch?.[1]) {
    const body = await readJsonBody(request);
    const result = await app.recordFounderValueMeasurement(
      founderValueMatch[1],
      body as import('@venture-advisor-os/shared-types').RecordFounderValueMeasurementRequestDto,
    );
    return {
      statusCode: 201,
      payload: result,
    };
  }

  const generatePrdMatch = request.url?.match(
    /^\/api\/cases\/([^/]+)\/generate-prd$/u,
  );
  if (request.method === 'POST' && generatePrdMatch?.[1]) {
    const result = await app.generatePrd(generatePrdMatch[1]);
    return {
      statusCode: 202,
      payload: result,
    };
  }

  const generatePocMatch = request.url?.match(
    /^\/api\/cases\/([^/]+)\/generate-poc$/u,
  );
  if (request.method === 'POST' && generatePocMatch?.[1]) {
    const result = await app.generatePoc(generatePocMatch[1]);
    return {
      statusCode: 202,
      payload: result,
    };
  }

  return {
    statusCode: 404,
    payload: {
      error: 'NOT_FOUND',
    },
  };
}

async function routeDashboardRequest(
  app: GatewayApiApp,
  request: IncomingMessage,
): Promise<RouteResponse | null> {
  if (request.method !== 'GET' || request.url !== '/dashboard') {
    return null;
  }

  const [portfolio, opportunityRanking, operatorMetrics] = await Promise.all([
    app.getPortfolio(6),
    app.getOpportunityRankingReport(),
    app.getOperatorMetricsReport(),
  ]);

  return {
    statusCode: 200,
    contentType: 'text/html; charset=utf-8',
    body: renderDashboardHtml({
      portfolio,
      opportunityRanking,
      operatorMetrics,
    }),
  };
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
    throw new InvalidJsonBodyError('Request body must be valid JSON.');
  }
}

function writeJson(
  response: ServerResponse,
  statusCode: number,
  payload: unknown,
): void {
  writeResponse(response, {
    statusCode,
    contentType: 'application/json; charset=utf-8',
    body: JSON.stringify(payload),
  });
}

function writeResponse(response: ServerResponse, result: RouteResponse): void {
  response.statusCode = result.statusCode;
  response.setHeader('content-type', result.contentType);
  response.end(result.body);
}

function renderDashboardHtml(input: {
  portfolio: Awaited<ReturnType<GatewayApiApp['getPortfolio']>>;
  opportunityRanking: Awaited<
    ReturnType<GatewayApiApp['getOpportunityRankingReport']>
  >;
  operatorMetrics: Awaited<ReturnType<GatewayApiApp['getOperatorMetricsReport']>>;
}): string {
  const portfolioRows = input.portfolio.rankedCases
    .map(
      (rankedCase) => `
        <tr>
          <td>${rankedCase.rank}</td>
          <td>${escapeHtml(rankedCase.case.topic)}</td>
          <td>${escapeHtml(rankedCase.case.status)}</td>
          <td>${escapeHtml(rankedCase.priorityBand)}</td>
          <td>${rankedCase.eligibleForNextTopic ? 'Yes' : 'No'}</td>
        </tr>`,
    )
    .join('');
  const opportunityRows = input.opportunityRanking.rankedCases
    .slice(0, 6)
    .map(
      (rankedCase) => `
        <tr>
          <td>${escapeHtml(rankedCase.topic)}</td>
          <td>${rankedCase.opportunityScore}</td>
          <td>${escapeHtml(rankedCase.latestDecision)}</td>
          <td>${rankedCase.vcScoreAverage}</td>
          <td>${rankedCase.evidenceScoreAverage}</td>
        </tr>`,
    )
    .join('');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Venture Advisor OS Dashboard</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f5efe3;
        --panel: rgba(255, 252, 246, 0.88);
        --ink: #1f1a14;
        --muted: #6d6256;
        --accent: #125b50;
        --accent-soft: #d6efe9;
        --line: rgba(31, 26, 20, 0.12);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Segoe UI", "Aptos", sans-serif;
        color: var(--ink);
        background:
          radial-gradient(circle at top left, #f7d6b5 0, transparent 28%),
          radial-gradient(circle at top right, #c8e6df 0, transparent 24%),
          linear-gradient(180deg, #f9f4ea 0%, var(--bg) 100%);
      }
      main {
        max-width: 1200px;
        margin: 0 auto;
        padding: 32px 20px 48px;
      }
      .hero {
        padding: 28px;
        border-radius: 24px;
        background: linear-gradient(135deg, rgba(18, 91, 80, 0.96), rgba(25, 120, 106, 0.9));
        color: white;
        box-shadow: 0 18px 40px rgba(18, 91, 80, 0.18);
      }
      .hero h1 {
        margin: 0 0 12px;
        font-size: 2rem;
      }
      .hero p {
        margin: 0;
        max-width: 720px;
        color: rgba(255, 255, 255, 0.88);
      }
      .cards {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 16px;
        margin: 20px 0 28px;
      }
      .card, section {
        background: var(--panel);
        backdrop-filter: blur(10px);
        border: 1px solid var(--line);
        border-radius: 20px;
        box-shadow: 0 10px 30px rgba(31, 26, 20, 0.08);
      }
      .card {
        padding: 20px;
      }
      .card .label {
        display: block;
        font-size: 0.8rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--muted);
      }
      .card .value {
        display: block;
        margin-top: 8px;
        font-size: 1.9rem;
        font-weight: 700;
      }
      .grid {
        display: grid;
        grid-template-columns: 1.2fr 1fr;
        gap: 20px;
      }
      section {
        padding: 22px;
      }
      h2 {
        margin: 0 0 14px;
        font-size: 1.1rem;
      }
      table {
        width: 100%;
        border-collapse: collapse;
      }
      th, td {
        text-align: left;
        padding: 10px 0;
        border-bottom: 1px solid var(--line);
        font-size: 0.95rem;
      }
      th {
        color: var(--muted);
        font-weight: 600;
      }
      .muted {
        color: var(--muted);
      }
      .metric-list {
        display: grid;
        gap: 12px;
      }
      .metric-list div {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        padding: 12px 14px;
        border-radius: 14px;
        background: var(--accent-soft);
      }
      @media (max-width: 900px) {
        .grid { grid-template-columns: 1fr; }
      }
    </style>
  </head>
  <body>
    <main>
      <div class="hero">
        <h1>Venture Advisor OS Dashboard</h1>
        <p>Rank active topics, inspect build-ready opportunities, and monitor runtime quality from one page.</p>
      </div>
      <div class="cards">
        <div class="card">
          <span class="label">Portfolio Cases</span>
          <span class="value">${input.portfolio.summary.totalCases}</span>
        </div>
        <div class="card">
          <span class="label">Next Topic Eligible</span>
          <span class="value">${input.portfolio.summary.nextTopicEligibleCount}</span>
        </div>
        <div class="card">
          <span class="label">Top Opportunity</span>
          <span class="value">${escapeHtml(input.opportunityRanking.summary.topOpportunityCaseId ?? 'n/a')}</span>
        </div>
        <div class="card">
          <span class="label">Schema Success</span>
          <span class="value">${Math.round(input.operatorMetrics.productMetrics.schemaValidationSuccessRate * 100)}%</span>
        </div>
      </div>
      <div class="grid">
        <section>
          <h2>Portfolio Queue</h2>
          <p class="muted">Fresh actionable topics stay ahead of manual-review failures to keep next-topic selection deterministic.</p>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Topic</th>
                <th>Status</th>
                <th>Band</th>
                <th>Next Topic</th>
              </tr>
            </thead>
            <tbody>${portfolioRows}</tbody>
          </table>
        </section>
        <section>
          <h2>Runtime Metrics</h2>
          <div class="metric-list">
            <div><span>Average iterations</span><strong>${input.operatorMetrics.productMetrics.averageIterationsPerCase}</strong></div>
            <div><span>PASS to PRD</span><strong>${Math.round(input.operatorMetrics.productMetrics.passToPrdCompletionRate * 100)}%</strong></div>
            <div><span>PASS to POC</span><strong>${Math.round(input.operatorMetrics.productMetrics.passToPocCompletionRate * 100)}%</strong></div>
            <div><span>Founder usefulness</span><strong>${input.operatorMetrics.founderValue.averagePerceivedUsefulnessScore}</strong></div>
          </div>
        </section>
      </div>
      <section style="margin-top: 20px;">
        <h2>Opportunity Ranking</h2>
        <p class="muted">Opportunity score blends latest Judge decision, VC scoring, evidence quality, founder-value signals, and build readiness.</p>
        <table>
          <thead>
            <tr>
              <th>Topic</th>
              <th>Score</th>
              <th>Decision</th>
              <th>VC Avg</th>
              <th>Evidence Avg</th>
            </tr>
          </thead>
          <tbody>${opportunityRows}</tbody>
        </table>
      </section>
    </main>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function resolveRequestId(request: IncomingMessage): string {
  const headerValue = request.headers['x-request-id'];
  if (typeof headerValue === 'string' && headerValue.trim().length > 0) {
    return headerValue;
  }

  return randomUUID();
}

function resolveRequestLogContext(
  request: IncomingMessage,
  requestId: string,
): Record<string, string> {
  const context: Record<string, string> = {
    requestId,
  };
  const caseIdMatch = request.url?.match(/^\/api\/cases\/([^/]+)(?:\/|$)/u);

  if (
    caseIdMatch?.[1] &&
    caseIdMatch[1] !== 'next-topic' &&
    caseIdMatch[1] !== 'portfolio'
  ) {
    context.caseId = caseIdMatch[1];
  }

  return context;
}

function isAuthorized(
  request: IncomingMessage,
  authToken?: string,
): boolean {
  if (!authToken) {
    return true;
  }

  const authorization = request.headers.authorization;
  return authorization === `Bearer ${authToken}`;
}

function resolveIdempotencyKey(request: IncomingMessage): string | null {
  const headerValue = request.headers['idempotency-key'];
  if (typeof headerValue === 'string' && headerValue.trim().length > 0) {
    return `${request.method}:${request.url}:${headerValue}`;
  }

  return null;
}

function isIdempotentCandidate(request: IncomingMessage): boolean {
  return request.method === 'POST';
}

async function routeOperationalRequest(
  request: IncomingMessage,
  options: GatewayApiHttpServerOptions,
): Promise<RouteResponse | null> {
  if (request.method === 'GET' && request.url === '/health') {
    const payload = await collectOperationalHealth(options.operational);
    return {
      statusCode: payload.status === 'ok' ? 200 : 503,
      contentType: 'application/json; charset=utf-8',
      body: JSON.stringify(payload),
    };
  }

  if (request.method === 'GET' && request.url === '/metrics') {
    const payload = await collectOperationalHealth(options.operational);
    const customMetrics = await resolveCustomMetrics(options.operational);
    return {
      statusCode: 200,
      contentType: 'text/plain; version=0.0.4; charset=utf-8',
      body: renderPrometheusMetrics(payload, customMetrics),
    };
  }

  return null;
}

async function collectOperationalHealth(
  options?: GatewayApiOperationalOptions,
): Promise<GatewayApiOperationalHealthPayload> {
  const generatedAt = (options?.now ?? (() => new Date()))().toISOString();
  const checks = await Promise.all(
    OPERATIONAL_DEPENDENCIES.map(async (dependencyName) => {
      const check = options?.checks?.[dependencyName];
      if (!check) {
        return [
          dependencyName,
          {
            ready: false,
            detail: 'Readiness check not configured.',
          },
        ] as const;
      }

      try {
        const result = await check();
        return [
          dependencyName,
          {
            ready: result.ready,
            detail: result.detail,
          },
        ] as const;
      } catch (error) {
        return [
          dependencyName,
          {
            ready: false,
            detail:
              error instanceof Error
                ? error.message
                : 'Readiness check failed.',
          },
        ] as const;
      }
    }),
  );

  const readiness = Object.fromEntries(checks) as Record<
    GatewayApiDependencyName,
    GatewayApiDependencyReadiness
  >;

  return {
    status: Object.values(readiness).every((check) => check.ready)
      ? 'ok'
      : 'degraded',
    generatedAt,
    checks: readiness,
  };
}

async function resolveCustomMetrics(
  options?: GatewayApiOperationalOptions,
): Promise<Record<string, number>> {
  if (!options?.collectMetrics) {
    return {};
  }

  return options.collectMetrics();
}

function renderPrometheusMetrics(
  health: GatewayApiOperationalHealthPayload,
  customMetrics: Record<string, number>,
): string {
  const lines = [
    '# HELP gateway_api_ready Gateway API operational readiness.',
    '# TYPE gateway_api_ready gauge',
    `gateway_api_ready ${health.status === 'ok' ? 1 : 0}`,
    '# HELP gateway_api_dependency_ready Dependency readiness by component.',
    '# TYPE gateway_api_dependency_ready gauge',
    ...OPERATIONAL_DEPENDENCIES.map(
      (dependencyName) =>
        `gateway_api_dependency_ready{component="${dependencyName}"} ${health.checks[dependencyName].ready ? 1 : 0}`,
    ),
  ];

  for (const [metricName, metricValue] of Object.entries(customMetrics)) {
    lines.push(`# TYPE ${metricName} gauge`);
    lines.push(`${metricName} ${metricValue}`);
  }

  return `${lines.join('\n')}\n`;
}

const OPERATIONAL_DEPENDENCIES = [
  'database',
  'queue',
  'worker',
  'storage',
] as const satisfies readonly GatewayApiDependencyName[];
