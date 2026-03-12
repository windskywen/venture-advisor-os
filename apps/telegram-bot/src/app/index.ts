import type {
  ApproveCaseActionDto,
  CaseSummaryDto,
  CaseActionResponseDto,
  CreateCaseRequestDto,
  CreateCaseResponseDto,
  GetCaseOutputsResponseDto,
  JudgeTaskPromptInput,
  NextTopicResponseDto,
  PortfolioOverviewDto,
  StartCaseResponseDto,
} from '@venture-advisor-os/shared-types';

export const TELEGRAM_BOT_APP_LAYER = '@venture-advisor-os/telegram-bot/app';

export interface TelegramBotGatewayApi {
  createCase(request: CreateCaseRequestDto): Promise<CreateCaseResponseDto>;
  startCase(caseId: string): Promise<StartCaseResponseDto>;
  getCase(caseId: string): Promise<CaseSummaryDto>;
  getCaseOutputs(caseId: string): Promise<GetCaseOutputsResponseDto>;
  approveCase(
    caseId: string,
    action: ApproveCaseActionDto,
  ): Promise<CaseActionResponseDto>;
  rejectCase(caseId: string): Promise<CaseActionResponseDto>;
  generatePrd(caseId: string): Promise<CaseActionResponseDto>;
  generatePoc(caseId: string): Promise<CaseActionResponseDto>;
  getNextTopic(): Promise<NextTopicResponseDto>;
  getPortfolio(limit?: number): Promise<PortfolioOverviewDto>;
}

export interface TelegramBotAppDependencies {
  gatewayApi: TelegramBotGatewayApi;
}

export interface TelegramBotApp {
  createIdea(topic: string): Promise<string>;
  startCase(caseId: string): Promise<string>;
  getCaseStatus(caseId: string): Promise<string>;
  approveCase(caseId: string, action: string): Promise<string>;
  rejectCase(caseId: string): Promise<string>;
  requestPrd(caseId: string): Promise<string>;
  requestPoc(caseId: string): Promise<string>;
  getNextTopic(): Promise<string>;
  getPortfolio(limitToken?: string): Promise<string>;
}

export function createTelegramBotApp(
  dependencies: TelegramBotAppDependencies,
): TelegramBotApp {
  return {
    async createIdea(topic) {
      const normalizedTopic = topic.trim();
      if (normalizedTopic.length === 0) {
        throw new TelegramBotCommandError('Usage: /newidea {topic}');
      }

      const createdCase = await dependencies.gatewayApi.createCase({
        topic: normalizedTopic,
      });

      return `Created case ${createdCase.caseId} for "${normalizedTopic}" (${createdCase.status}). Use /startcase ${createdCase.caseId} to begin.`;
    },
    async startCase(caseId) {
      const normalizedCaseId = normalizeCaseId(
        caseId,
        'Usage: /startcase {caseId}',
      );

      const startResult = await dependencies.gatewayApi.startCase(normalizedCaseId);

      return `Started case ${startResult.caseId}. Workflow queued as ${startResult.queuedJobId}. Use /status ${startResult.caseId} to track progress.`;
    },
    async getCaseStatus(caseId) {
      const normalizedCaseId = normalizeCaseId(caseId, 'Usage: /status {caseId}');
      const [caseSummary, caseOutputs] = await Promise.all([
        dependencies.gatewayApi.getCase(normalizedCaseId),
        dependencies.gatewayApi.getCaseOutputs(normalizedCaseId),
      ]);

      return formatCaseStatusSummary(caseSummary, caseOutputs);
    },
    async approveCase(caseId, action) {
      const normalizedCaseId = normalizeCaseId(
        caseId,
        'Usage: /approve {caseId} {FORCE_REVISE|FORCE_PIVOT|FORCE_PASS_TO_PRD}',
      );
      const normalizedAction = normalizeApproveAction(action);
      if (normalizedAction === null) {
        throw new TelegramBotCommandError(
          'Usage: /approve {caseId} {FORCE_REVISE|FORCE_PIVOT|FORCE_PASS_TO_PRD}',
        );
      }

      const approvalResult = await dependencies.gatewayApi.approveCase(
        normalizedCaseId,
        normalizedAction,
      );

      return `Override ${normalizedAction} accepted for case ${approvalResult.caseId}. Status: ${approvalResult.status}. Use /status ${approvalResult.caseId} to review next steps.`;
    },
    async rejectCase(caseId) {
      const normalizedCaseId = normalizeCaseId(caseId, 'Usage: /reject {caseId}');

      const rejectionResult = await dependencies.gatewayApi.rejectCase(
        normalizedCaseId,
      );

      return `Case ${rejectionResult.caseId} closed with status ${rejectionResult.status}. Use /status ${rejectionResult.caseId} to review closure details.`;
    },
    async requestPrd(caseId) {
      const normalizedCaseId = normalizeCaseId(caseId, 'Usage: /prd {caseId}');

      const prdResult = await dependencies.gatewayApi.generatePrd(
        normalizedCaseId,
      );

      return `PRD generation requested for case ${prdResult.caseId}. Status: ${prdResult.status}. Use /status ${prdResult.caseId} to monitor progress.`;
    },
    async requestPoc(caseId) {
      const normalizedCaseId = normalizeCaseId(caseId, 'Usage: /poc {caseId}');

      const pocResult = await dependencies.gatewayApi.generatePoc(
        normalizedCaseId,
      );

      return `POC generation requested for case ${pocResult.caseId}. Status: ${pocResult.status}. Use /status ${pocResult.caseId} to monitor progress.`;
    },
    async getNextTopic() {
      const nextTopic = await dependencies.gatewayApi.getNextTopic();
      if (nextTopic.case === null) {
        return 'No pending topic is available right now.';
      }

      return [
        `Next topic case ${nextTopic.case.caseId}`,
        `Topic: ${nextTopic.case.topic}`,
        `Status: ${nextTopic.case.status}`,
        `Latest decision: ${nextTopic.case.latestDecision ?? 'PENDING'}`,
        `Next: ${formatNextSteps(nextTopic.case.nextSteps)}`,
      ].join('\n');
    },
    async getPortfolio(limitToken) {
      const portfolio = await dependencies.gatewayApi.getPortfolio(
        normalizePortfolioLimit(limitToken),
      );

      return formatPortfolioOverview(portfolio);
    },
  };
}

export class TelegramBotCommandError extends Error {}

function formatNextSteps(nextSteps: string[]): string {
  if (nextSteps.length === 0) {
    return 'No next steps available.';
  }

  return nextSteps.join(' | ');
}

function formatPortfolioOverview(portfolio: PortfolioOverviewDto): string {
  if (portfolio.rankedCases.length === 0) {
    return 'Portfolio is empty right now.';
  }

  const lines = [
    `Portfolio queue${portfolio.nextTopicCaseId ? ` (next: ${portfolio.nextTopicCaseId})` : ''}`,
  ];

  for (const rankedCase of portfolio.rankedCases) {
    lines.push(
      `${rankedCase.rank}. ${rankedCase.case.caseId} [${rankedCase.priorityBand}] ${rankedCase.case.status} - ${rankedCase.case.topic}`,
    );
  }

  lines.push(
    `Summary: total=${portfolio.summary.totalCases}, next-topic eligible=${portfolio.summary.nextTopicEligibleCount}`,
  );

  return lines.join('\n');
}

function formatCaseStatusSummary(
  caseSummary: CaseSummaryDto,
  caseOutputs: GetCaseOutputsResponseDto,
): string {
  const lines = [
    `Case ${caseSummary.caseId}`,
    `Status: ${caseSummary.status}`,
    `Judge: ${caseSummary.latestDecision ?? 'PENDING'}`,
  ];

  const judgeTasks = resolveJudgeTasks(caseOutputs);
  if (
    (caseSummary.latestDecision === 'REVISE' ||
      caseSummary.latestDecision === 'PIVOT') &&
    judgeTasks.length > 0
  ) {
    lines.push(`Tasks: ${judgeTasks.map(formatJudgeTask).join(' | ')}`);
  }

  if (caseSummary.rejectionRationale) {
    lines.push(`Rejection: ${caseSummary.rejectionRationale}`);
  }

  lines.push(`PRD: ${resolvePrdReadiness(caseSummary)}`);
  lines.push(`POC: ${resolvePocReadiness(caseSummary)}`);
  lines.push(`Next: ${formatNextSteps(caseSummary.nextSteps)}`);

  return lines.join('\n');
}

function resolveJudgeTasks(
  caseOutputs: GetCaseOutputsResponseDto,
): JudgeTaskPromptInput[] {
  const judgeOutput = caseOutputs.latestNormalizedOutputs.Judge;
  if (
    judgeOutput &&
    typeof judgeOutput === 'object' &&
    Array.isArray((judgeOutput as { next_iteration_tasks?: unknown }).next_iteration_tasks)
  ) {
    return (judgeOutput as { next_iteration_tasks: JudgeTaskPromptInput[] })
      .next_iteration_tasks;
  }

  return [];
}

function formatJudgeTask(task: JudgeTaskPromptInput): string {
  return `${task.target_agent}:${task.task_type}:${task.description}`;
}

function resolvePrdReadiness(caseSummary: CaseSummaryDto): string {
  if (caseSummary.hasPrd) {
    return 'ready';
  }

  if (caseSummary.status === 'PRD_IN_PROGRESS') {
    return 'in progress';
  }

  return 'not ready';
}

function resolvePocReadiness(caseSummary: CaseSummaryDto): string {
  if (caseSummary.hasPoc) {
    return 'ready';
  }

  if (caseSummary.status === 'POC_IN_PROGRESS') {
    return 'in progress';
  }

  return 'not ready';
}

function normalizeApproveAction(
  action: string,
): ApproveCaseActionDto | null {
  const normalizedAction = action.trim().toUpperCase();
  if (APPROVE_ACTIONS.includes(normalizedAction as ApproveCaseActionDto)) {
    return normalizedAction as ApproveCaseActionDto;
  }

  return null;
}

const APPROVE_ACTIONS = [
  'FORCE_REVISE',
  'FORCE_PIVOT',
  'FORCE_PASS_TO_PRD',
] as const satisfies readonly ApproveCaseActionDto[];

function normalizePortfolioLimit(limitToken?: string): number | undefined {
  if (limitToken === undefined || limitToken.trim().length === 0) {
    return undefined;
  }

  const parsedLimit = Number(limitToken.trim());
  if (!Number.isInteger(parsedLimit) || parsedLimit <= 0 || parsedLimit > 50) {
    throw new TelegramBotCommandError('Usage: /portfolio {limit?}');
  }

  return parsedLimit;
}

function normalizeCaseId(caseId: string, usageMessage: string): string {
  const normalizedCaseId = caseId.trim();
  if (
    normalizedCaseId.length === 0 ||
    !SAFE_CASE_ID_PATTERN.test(normalizedCaseId)
  ) {
    throw new TelegramBotCommandError(usageMessage);
  }

  return normalizedCaseId;
}

const SAFE_CASE_ID_PATTERN = /^[A-Za-z0-9_-]+$/u;
