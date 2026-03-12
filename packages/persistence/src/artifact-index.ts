import {
  type OutputArtifactDto,
  createCaseStorageManifest,
  createIterationStorageManifest,
} from '@venture-advisor-os/shared-types';

import type { FileStorageAdapter, StoredArtifactRef } from './file-storage.js';

export interface ArtifactIndexService {
  listCaseArtifacts(caseId: string): Promise<OutputArtifactDto[]>;
  listIterationArtifacts(
    caseId: string,
    iterationNo: number,
  ): Promise<OutputArtifactDto[]>;
  listLatestOutputArtifacts(
    caseId: string,
    latestIterationNo?: number | null,
  ): Promise<OutputArtifactDto[]>;
}

export function createArtifactIndexService(
  storage: FileStorageAdapter,
): ArtifactIndexService {
  return {
    async listCaseArtifacts(caseId) {
      const artifacts = await storage.listCaseArtifacts(caseId);
      return artifacts
        .map(mapStoredArtifactToOutputArtifact)
        .filter((artifact): artifact is OutputArtifactDto => artifact !== null);
    },
    async listIterationArtifacts(caseId, iterationNo) {
      const artifacts = await storage.listCaseArtifacts(caseId);
      const iterationPrefix = createIterationStorageManifest(
        caseId,
        iterationNo,
      ).root;

      return artifacts
        .filter((artifact) => artifact.relativePath.startsWith(iterationPrefix))
        .map(mapStoredArtifactToOutputArtifact)
        .filter((artifact): artifact is OutputArtifactDto => artifact !== null);
    },
    async listLatestOutputArtifacts(caseId, latestIterationNo) {
      const artifacts = await storage.listCaseArtifacts(caseId);
      const artifactMap = new Map(
        artifacts.map((artifact) => [artifact.relativePath, artifact]),
      );
      const caseManifest = createCaseStorageManifest(caseId);
      const latestArtifacts: OutputArtifactDto[] = [];

      appendIfPresent(
        artifactMap,
        caseManifest.approvedBusinessSummaryFile,
        'approved-business-summary',
        latestArtifacts,
      );
      appendIfPresent(
        artifactMap,
        caseManifest.finalBusinessPlanFile,
        'business-plan',
        latestArtifacts,
      );
      appendIfPresent(
        artifactMap,
        caseManifest.prdFile,
        'prd',
        latestArtifacts,
      );
      appendIfPresent(
        artifactMap,
        caseManifest.pocSpecFile,
        'poc',
        latestArtifacts,
      );
      appendIfPresent(
        artifactMap,
        caseManifest.implementationHandoffFile,
        'handoff',
        latestArtifacts,
      );
      appendIfPresent(
        artifactMap,
        caseManifest.codexExecutionPlanFile,
        'codex-execution-plan',
        latestArtifacts,
      );

      if (latestIterationNo !== undefined && latestIterationNo !== null) {
        const iterationManifest = createIterationStorageManifest(
          caseId,
          latestIterationNo,
        );

        for (const relativePath of Object.values(
          iterationManifest.outputFiles,
        )) {
          appendIfPresent(
            artifactMap,
            relativePath,
            'normalized-output',
            latestArtifacts,
          );
        }

        for (const relativePath of Object.values(iterationManifest.rawFiles)) {
          appendIfPresent(
            artifactMap,
            relativePath,
            'raw-output',
            latestArtifacts,
          );
        }
      }

      return latestArtifacts;
    },
  };
}

function appendIfPresent(
  artifactMap: Map<string, StoredArtifactRef>,
  relativePath: string,
  kind: OutputArtifactDto['kind'],
  target: OutputArtifactDto[],
): void {
  const artifact = artifactMap.get(relativePath);
  if (!artifact) {
    return;
  }

  target.push({
    name: artifact.relativePath.split('/').at(-1) ?? artifact.relativePath,
    path: artifact.relativePath,
    kind,
  });
}

function mapStoredArtifactToOutputArtifact(
  artifact: StoredArtifactRef,
): OutputArtifactDto | null {
  const fileName =
    artifact.relativePath.split('/').at(-1) ?? artifact.relativePath;

  if (fileName === 'case.json') {
    return null;
  }

  if (
    fileName === 'approved_business_summary.json' ||
    fileName === 'final_business_plan.md' ||
    fileName === 'prd.md' ||
    fileName === 'poc_spec.md' ||
    fileName === 'implementation_handoff.json' ||
    fileName === 'codex_execution_plan.md'
  ) {
    return {
      name: fileName,
      path: artifact.relativePath,
      kind: mapRootArtifactKind(fileName),
    };
  }

  if (fileName.endsWith('.raw.json')) {
    return {
      name: fileName,
      path: artifact.relativePath,
      kind: 'raw-output',
    };
  }

  return {
    name: fileName,
    path: artifact.relativePath,
    kind: 'normalized-output',
  };
}

function mapRootArtifactKind(fileName: string): OutputArtifactDto['kind'] {
  switch (fileName) {
    case 'approved_business_summary.json':
      return 'approved-business-summary';
    case 'final_business_plan.md':
      return 'business-plan';
    case 'prd.md':
      return 'prd';
    case 'poc_spec.md':
      return 'poc';
    case 'implementation_handoff.json':
      return 'handoff';
    case 'codex_execution_plan.md':
      return 'codex-execution-plan';
    default:
      return 'normalized-output';
  }
}
