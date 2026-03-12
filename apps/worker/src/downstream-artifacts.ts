import {
  type AgentOutput,
  FactResearcherOutputSchema,
  JudgeOutputSchema,
  type OpportunityCase,
  OpportunityStrategistOutputSchema,
  PocArchitectOutputSchema,
  PrdStrategistOutputSchema,
  type StructuredLogger,
  VcCriticOutputSchema,
  createNoopStructuredLogger,
} from '@venture-advisor-os/shared-types';
import {
  composeApprovedBusinessSummary,
  composeImplementationHandoff,
  renderCodexExecutionPlan,
  renderFinalBusinessPlan,
  renderPocSpec,
  renderPrd,
} from '@venture-advisor-os/report-renderer';

export interface DownstreamArtifactStorageManifest {
  approvedBusinessSummaryFile: string;
  finalBusinessPlanFile: string;
  prdFile: string;
  pocSpecFile: string;
  implementationHandoffFile: string;
  codexExecutionPlanFile: string;
}

export interface DownstreamArtifactStorage {
  getCaseManifest(caseId: string): DownstreamArtifactStorageManifest;
  readText(relativePath: string): Promise<string | null>;
  writeApprovedBusinessSummary(
    caseId: string,
    content: unknown,
  ): Promise<{ relativePath: string }>;
  writeFinalBusinessPlan(
    caseId: string,
    markdown: string,
  ): Promise<{ relativePath: string }>;
  writePrd(
    caseId: string,
    markdown: string,
  ): Promise<{ relativePath: string }>;
  writePocSpec(
    caseId: string,
    markdown: string,
  ): Promise<{ relativePath: string }>;
  writeImplementationHandoff(
    caseId: string,
    content: unknown,
  ): Promise<{ relativePath: string }>;
  writeCodexExecutionPlan(
    caseId: string,
    markdown: string,
  ): Promise<{ relativePath: string }>;
}

export interface DownstreamArtifactRepositories {
  cases: {
    getById(caseId: string): Promise<OpportunityCase | null>;
  };
  agentOutputs: {
    listByCaseId(caseId: string): Promise<AgentOutput[]>;
  };
}

export interface DownstreamArtifactServiceDependencies {
  repositories: DownstreamArtifactRepositories;
  storage: DownstreamArtifactStorage;
  logger?: StructuredLogger;
  now?: () => Date;
}

export interface EnsureArtifactResult {
  caseId: string;
  approvedIterationNo: number;
  artifactPath: string;
  created: boolean;
}

export interface EnsureApprovedArtifactsResult {
  caseId: string;
  approvedIterationNo: number;
  approvedBusinessSummaryPath: string;
  finalBusinessPlanPath: string;
  created: boolean;
}

export interface DownstreamArtifactService {
  ensureApprovedArtifacts(
    caseId: string,
  ): Promise<EnsureApprovedArtifactsResult>;
  ensurePrdArtifact(caseId: string): Promise<EnsureArtifactResult>;
  ensurePocArtifact(caseId: string): Promise<EnsureArtifactResult>;
  ensureImplementationHandoff(caseId: string): Promise<EnsureArtifactResult>;
}

export function createDownstreamArtifactService(
  dependencies: DownstreamArtifactServiceDependencies,
): DownstreamArtifactService {
  const now = dependencies.now ?? (() => new Date());
  const logger = dependencies.logger ?? createNoopStructuredLogger();
  const ensureApprovedArtifacts = async (
    caseId: string,
  ): Promise<EnsureApprovedArtifactsResult> => {
    const context = await loadApprovedCaseContext(dependencies, caseId);
    const manifest = dependencies.storage.getCaseManifest(caseId);
    const generatedAt = now().toISOString();
    const approvedSummary = composeApprovedArtifacts(context, generatedAt);

    let approvedBusinessSummaryPath = manifest.approvedBusinessSummaryFile;
    let finalBusinessPlanPath = manifest.finalBusinessPlanFile;
    let created = false;

    if (
      (await dependencies.storage.readText(manifest.approvedBusinessSummaryFile)) ===
      null
    ) {
      approvedBusinessSummaryPath = (
        await dependencies.storage.writeApprovedBusinessSummary(
          caseId,
          approvedSummary.approvedBusinessSummary,
        )
      ).relativePath;
      created = true;
      logArtifactStorage(logger, {
        event: 'storage.artifact.written',
        message: 'Wrote a downstream artifact to storage.',
        artifactType: 'approved_business_summary',
        artifactPath: approvedBusinessSummaryPath,
        caseId,
        iterationId: context.caseRecord.approvedSourceIterationId,
        approvedIterationNo: context.approvedIterationNo,
      });
    } else {
      logArtifactStorage(logger, {
        event: 'storage.artifact.reused',
        message: 'Reused an existing downstream artifact path.',
        artifactType: 'approved_business_summary',
        artifactPath: manifest.approvedBusinessSummaryFile,
        caseId,
        iterationId: context.caseRecord.approvedSourceIterationId,
        approvedIterationNo: context.approvedIterationNo,
      });
    }

    if (
      (await dependencies.storage.readText(manifest.finalBusinessPlanFile)) ===
      null
    ) {
      finalBusinessPlanPath = (
        await dependencies.storage.writeFinalBusinessPlan(
          caseId,
          approvedSummary.finalBusinessPlan,
        )
      ).relativePath;
      created = true;
      logArtifactStorage(logger, {
        event: 'storage.artifact.written',
        message: 'Wrote a downstream artifact to storage.',
        artifactType: 'final_business_plan',
        artifactPath: finalBusinessPlanPath,
        caseId,
        iterationId: context.caseRecord.approvedSourceIterationId,
        approvedIterationNo: context.approvedIterationNo,
      });
    } else {
      logArtifactStorage(logger, {
        event: 'storage.artifact.reused',
        message: 'Reused an existing downstream artifact path.',
        artifactType: 'final_business_plan',
        artifactPath: manifest.finalBusinessPlanFile,
        caseId,
        iterationId: context.caseRecord.approvedSourceIterationId,
        approvedIterationNo: context.approvedIterationNo,
      });
    }

    return {
      caseId,
      approvedIterationNo: context.approvedIterationNo,
      approvedBusinessSummaryPath,
      finalBusinessPlanPath,
      created,
    };
  };
  const ensurePrdArtifact = async (
    caseId: string,
  ): Promise<EnsureArtifactResult> => {
    const context = await loadApprovedCaseContext(dependencies, caseId);
    const manifest = dependencies.storage.getCaseManifest(caseId);
    const existingArtifact = await dependencies.storage.readText(manifest.prdFile);

    if (existingArtifact !== null) {
      logArtifactStorage(logger, {
        event: 'storage.artifact.reused',
        message: 'Reused an existing downstream artifact path.',
        artifactType: 'prd',
        artifactPath: manifest.prdFile,
        caseId,
        iterationId: context.caseRecord.approvedSourceIterationId,
        approvedIterationNo: context.approvedIterationNo,
      });
      return {
        caseId,
        approvedIterationNo: context.approvedIterationNo,
        artifactPath: manifest.prdFile,
        created: false,
      };
    }

    const prdOutput = PrdStrategistOutputSchema.parse(
      findLatestAgentOutput(context.outputs, 'PRDStrategist').normalizedOutput,
    );
    const artifact = await dependencies.storage.writePrd(
      caseId,
      renderPrd({
        caseId,
        topic: context.caseRecord.topic,
        approvedIterationNo: context.approvedIterationNo,
        prd: prdOutput,
        generatedAt: now().toISOString(),
      }),
    );
    logArtifactStorage(logger, {
      event: 'storage.artifact.written',
      message: 'Wrote a downstream artifact to storage.',
      artifactType: 'prd',
      artifactPath: artifact.relativePath,
      caseId,
      iterationId: context.caseRecord.approvedSourceIterationId,
      approvedIterationNo: context.approvedIterationNo,
    });

    return {
      caseId,
      approvedIterationNo: context.approvedIterationNo,
      artifactPath: artifact.relativePath,
      created: true,
    };
  };
  const ensurePocArtifact = async (
    caseId: string,
  ): Promise<EnsureArtifactResult> => {
    const prdResult = await ensurePrdArtifact(caseId);
    const context = await loadApprovedCaseContext(dependencies, caseId);
    const manifest = dependencies.storage.getCaseManifest(caseId);
    const existingArtifact = await dependencies.storage.readText(
      manifest.pocSpecFile,
    );

    if (existingArtifact !== null) {
      logArtifactStorage(logger, {
        event: 'storage.artifact.reused',
        message: 'Reused an existing downstream artifact path.',
        artifactType: 'poc_spec',
        artifactPath: manifest.pocSpecFile,
        caseId,
        iterationId: context.caseRecord.approvedSourceIterationId,
        approvedIterationNo: context.approvedIterationNo,
      });
      return {
        caseId,
        approvedIterationNo: context.approvedIterationNo,
        artifactPath: manifest.pocSpecFile,
        created: false,
      };
    }

    const pocOutput = PocArchitectOutputSchema.parse(
      findLatestAgentOutput(context.outputs, 'POCArchitect').normalizedOutput,
    );
    const artifact = await dependencies.storage.writePocSpec(
      caseId,
      renderPocSpec({
        caseId,
        topic: context.caseRecord.topic,
        approvedIterationNo: context.approvedIterationNo,
        poc: pocOutput,
        generatedAt: now().toISOString(),
      }),
    );
    logArtifactStorage(logger, {
      event: 'storage.artifact.written',
      message: 'Wrote a downstream artifact to storage.',
      artifactType: 'poc_spec',
      artifactPath: artifact.relativePath,
      caseId,
      iterationId: context.caseRecord.approvedSourceIterationId,
      approvedIterationNo: prdResult.approvedIterationNo,
    });

    return {
      caseId,
      approvedIterationNo: prdResult.approvedIterationNo,
      artifactPath: artifact.relativePath,
      created: true,
    };
  };
  const ensureImplementationHandoff = async (
    caseId: string,
  ): Promise<EnsureArtifactResult> => {
    const approvedArtifacts = await ensureApprovedArtifacts(caseId);
    const prdArtifact = await ensurePrdArtifact(caseId);
    const pocArtifact = await ensurePocArtifact(caseId);
    const context = await loadApprovedCaseContext(dependencies, caseId);
    const manifest = dependencies.storage.getCaseManifest(caseId);
    const existingArtifact = await dependencies.storage.readText(
      manifest.implementationHandoffFile,
    );
    const existingCodexPlan = await dependencies.storage.readText(
      manifest.codexExecutionPlanFile,
    );

    if (existingArtifact !== null && existingCodexPlan !== null) {
      logArtifactStorage(logger, {
        event: 'storage.artifact.reused',
        message: 'Reused an existing downstream artifact path.',
        artifactType: 'implementation_handoff',
        artifactPath: manifest.implementationHandoffFile,
        caseId,
        iterationId: context.caseRecord.approvedSourceIterationId,
        approvedIterationNo: context.approvedIterationNo,
      });
      return {
        caseId,
        approvedIterationNo: context.approvedIterationNo,
        artifactPath: manifest.implementationHandoffFile,
        created: false,
      };
    }

    const approvedSummary = composeApprovedArtifacts(
      context,
      now().toISOString(),
    ).approvedBusinessSummary;
    const prdOutput = PrdStrategistOutputSchema.parse(
      findLatestAgentOutput(context.outputs, 'PRDStrategist').normalizedOutput,
    );
    const pocOutput = PocArchitectOutputSchema.parse(
      findLatestAgentOutput(context.outputs, 'POCArchitect').normalizedOutput,
    );
    const generatedAt = now().toISOString();
    const handoffArtifact = composeImplementationHandoff({
      caseId,
      approvedIterationNo: context.approvedIterationNo,
      approvedBusinessSummary: approvedSummary,
      prd: prdOutput,
      poc: pocOutput,
      artifactRefs: {
        approvedBusinessSummary: approvedArtifacts.approvedBusinessSummaryPath,
        finalBusinessPlan: approvedArtifacts.finalBusinessPlanPath,
        prd: prdArtifact.artifactPath,
        pocSpec: pocArtifact.artifactPath,
        codexExecutionPlan: manifest.codexExecutionPlanFile,
      },
      generatedAt,
    });
    const artifact = await dependencies.storage.writeImplementationHandoff(
      caseId,
      handoffArtifact,
    );
    await dependencies.storage.writeCodexExecutionPlan(
      caseId,
      renderCodexExecutionPlan(handoffArtifact),
    );
    logArtifactStorage(logger, {
      event: 'storage.artifact.written',
      message: 'Wrote a downstream artifact to storage.',
      artifactType: 'implementation_handoff',
      artifactPath: artifact.relativePath,
      caseId,
      iterationId: context.caseRecord.approvedSourceIterationId,
      approvedIterationNo: context.approvedIterationNo,
    });

    return {
      caseId,
      approvedIterationNo: context.approvedIterationNo,
      artifactPath: artifact.relativePath,
      created: true,
    };
  };

  return {
    ensureApprovedArtifacts,
    ensurePrdArtifact,
    ensurePocArtifact,
    ensureImplementationHandoff,
  };
}

async function loadApprovedCaseContext(
  dependencies: DownstreamArtifactServiceDependencies,
  caseId: string,
): Promise<{
  caseRecord: OpportunityCase;
  approvedIterationNo: number;
  outputs: AgentOutput[];
}> {
  const caseRecord = await dependencies.repositories.cases.getById(caseId);
  if (!caseRecord) {
    throw new Error(`Case ${caseId} was not found.`);
  }

  if (!caseRecord.approvedSourceIterationNo) {
    throw new Error(
      `Case ${caseId} is missing approvedSourceIterationNo and cannot trace downstream artifacts safely.`,
    );
  }

  return {
    caseRecord,
    approvedIterationNo: caseRecord.approvedSourceIterationNo,
    outputs: await dependencies.repositories.agentOutputs.listByCaseId(caseId),
  };
}

function findLatestAgentOutput(
  outputs: readonly AgentOutput[],
  agentName: AgentOutput['agentName'],
): AgentOutput {
  const match = [...outputs]
    .filter((output) => output.agentName === agentName)
    .sort((left, right) => {
      if (left.iterationNo !== right.iterationNo) {
        return right.iterationNo - left.iterationNo;
      }

      return right.createdAt.localeCompare(left.createdAt);
    })[0];

  if (!match) {
    throw new Error(`No normalized output was found for agent ${agentName}.`);
  }

  return match;
}

function findIterationAgentOutput(
  outputs: readonly AgentOutput[],
  agentName: AgentOutput['agentName'],
  iterationNo: number,
): AgentOutput {
  const match = [...outputs]
    .filter(
      (output) =>
        output.agentName === agentName && output.iterationNo === iterationNo,
    )
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];

  if (!match) {
    throw new Error(
      `No normalized output was found for agent ${agentName} on approved iteration ${iterationNo}.`,
    );
  }

  return match;
}

function composeApprovedArtifacts(
  context: {
    caseRecord: OpportunityCase;
    approvedIterationNo: number;
    outputs: AgentOutput[];
  },
  generatedAt: string,
): {
  approvedBusinessSummary: ReturnType<typeof composeApprovedBusinessSummary>;
  finalBusinessPlan: string;
} {
  const factResearch = FactResearcherOutputSchema.parse(
    findIterationAgentOutput(
      context.outputs,
      'FactResearcher',
      context.approvedIterationNo,
    ).normalizedOutput,
  );
  const opportunityStrategy = OpportunityStrategistOutputSchema.parse(
    findIterationAgentOutput(
      context.outputs,
      'OpportunityStrategist',
      context.approvedIterationNo,
    ).normalizedOutput,
  );
  const vcCritic = VcCriticOutputSchema.parse(
    findIterationAgentOutput(
      context.outputs,
      'VCCritic',
      context.approvedIterationNo,
    ).normalizedOutput,
  );
  const judge = JudgeOutputSchema.parse(
    findIterationAgentOutput(
      context.outputs,
      'Judge',
      context.approvedIterationNo,
    ).normalizedOutput,
  );
  const approvedBusinessSummary = composeApprovedBusinessSummary({
    caseId: context.caseRecord.caseId,
    topic: context.caseRecord.topic,
    approvedIterationNo: context.approvedIterationNo,
    factResearch,
    opportunityStrategy,
    vcCritic,
    judge,
    generatedAt,
  });

  return {
    approvedBusinessSummary,
    finalBusinessPlan: renderFinalBusinessPlan({
      caseId: context.caseRecord.caseId,
      topic: context.caseRecord.topic,
      region: context.caseRecord.region,
      founderProfile: context.caseRecord.founderProfile,
      preferredBusinessModels: context.caseRecord.preferredBusinessModels,
      constraints: context.caseRecord.constraints,
      approvedIterationNo: context.approvedIterationNo,
      factResearch,
      opportunityStrategy,
      vcCritic,
      judge,
      generatedAt,
      sourceOutputRefs: approvedBusinessSummary.sourceOutputRefs,
    }),
  };
}

function logArtifactStorage(
  logger: StructuredLogger,
  input: {
    event: 'storage.artifact.reused' | 'storage.artifact.written';
    message: string;
    artifactType:
      | 'approved_business_summary'
      | 'final_business_plan'
      | 'prd'
      | 'poc_spec'
      | 'implementation_handoff';
    artifactPath: string;
    caseId: string;
    iterationId?: string;
    approvedIterationNo: number;
  },
): void {
  logger.info(input.event, input.message, {
    caseId: input.caseId,
    iterationId: input.iterationId,
    approvedIterationNo: input.approvedIterationNo,
    artifactType: input.artifactType,
    artifactPath: input.artifactPath,
  });
}
