import type {
  AgentOutput,
  JudgeTask,
  Iteration,
  OpportunityCase,
  OutputArtifactDto,
  ScoreDetail,
} from '@venture-advisor-os/shared-types';

import {
  createIterationStorageManifest,
  type IterationRawFileName,
  type IterationOutputFileName,
} from '@venture-advisor-os/shared-types';

import type { ArtifactIndexService } from './artifact-index.js';
import type { FileStorageAdapter, StoredArtifactRef } from './file-storage.js';
import type { PersistenceRepositories } from './repositories.js';

const REUSABLE_RESEARCH_ARTIFACT_NAMES = new Set<
  IterationOutputFileName | IterationRawFileName
>([
  'market_facts.md',
  'pain_evidence.md',
  'competitor_map.md',
  'fact_researcher.raw.json',
]);

export interface IterationSnapshot {
  caseRecord: OpportunityCase;
  iteration: Iteration;
  agentOutputs: AgentOutput[];
  judgeTasks: JudgeTask[];
  scoreDetails: ScoreDetail[];
  artifactRefs: OutputArtifactDto[];
  capturedAt: string;
}

export interface ResearchArtifactRef extends OutputArtifactDto {
  sourceIterationNo: number;
}

export interface IterationSnapshotService {
  captureSnapshot(
    caseId: string,
    iterationId: string,
  ): Promise<{ snapshot: IterationSnapshot; artifact: StoredArtifactRef }>;
  buildReusableResearchArtifactRefs(
    caseId: string,
    sourceIterationNo: number,
  ): Promise<ResearchArtifactRef[]>;
  writeReusableResearchArtifactRefs(
    caseId: string,
    targetIterationNo: number,
    refs: readonly ResearchArtifactRef[],
  ): Promise<StoredArtifactRef>;
  readReusableResearchArtifactRefs(
    caseId: string,
    targetIterationNo: number,
  ): Promise<ResearchArtifactRef[]>;
}

export function createIterationSnapshotService(
  repositories: PersistenceRepositories,
  storage: FileStorageAdapter,
  artifactIndex: ArtifactIndexService,
): IterationSnapshotService {
  return {
    async captureSnapshot(caseId, iterationId) {
      const caseRecord = await repositories.cases.getById(caseId);
      const iteration = await repositories.iterations.getById(iterationId);

      if (!caseRecord) {
        throw new Error(`Opportunity case not found: ${caseId}`);
      }

      if (!iteration || iteration.caseId !== caseId) {
        throw new Error(
          `Iteration not found for case ${caseId}: ${iterationId}`,
        );
      }

      const [agentOutputs, judgeTasks, scoreDetails, artifactRefs] =
        await Promise.all([
          repositories.agentOutputs.listByIterationId(iterationId),
          repositories.judgeTasks.listByIterationId(iterationId),
          repositories.scoreDetails.listByIterationId(iterationId),
          artifactIndex.listIterationArtifacts(caseId, iteration.iterationNo),
        ]);

      const snapshot: IterationSnapshot = {
        caseRecord,
        iteration,
        agentOutputs,
        judgeTasks,
        scoreDetails,
        artifactRefs,
        capturedAt: new Date().toISOString(),
      };

      const artifact = await storage.writeIterationInput(
        caseId,
        iteration.iterationNo,
        'iteration_snapshot.json',
        snapshot,
      );

      return { snapshot, artifact };
    },
    async buildReusableResearchArtifactRefs(caseId, sourceIterationNo) {
      const artifacts = await artifactIndex.listIterationArtifacts(
        caseId,
        sourceIterationNo,
      );

      return artifacts
        .filter((artifact) =>
          REUSABLE_RESEARCH_ARTIFACT_NAMES.has(
            artifact.name as IterationOutputFileName | IterationRawFileName,
          ),
        )
        .map((artifact) => ({
          ...artifact,
          sourceIterationNo,
        }));
    },
    writeReusableResearchArtifactRefs(caseId, targetIterationNo, refs) {
      return storage.writeIterationInput(
        caseId,
        targetIterationNo,
        'research_artifact_refs.json',
        refs,
      );
    },
    async readReusableResearchArtifactRefs(caseId, targetIterationNo) {
      const manifest = createIterationStorageManifest(
        caseId,
        targetIterationNo,
      );
      return (
        (await storage.readJson<ResearchArtifactRef[]>(
          `${manifest.inputsRoot}/research_artifact_refs.json`,
        )) ?? []
      );
    },
  };
}
