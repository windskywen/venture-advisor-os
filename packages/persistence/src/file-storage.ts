import {
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';

import {
  ITERATION_OUTPUT_FILE_NAMES,
  ITERATION_RAW_FILE_NAMES,
  createCaseStorageManifest,
  createIterationStorageManifest,
  isAllowedStorageRelativePath,
  normalizeStoragePath,
  type CaseStorageManifest,
  type IterationStorageManifest,
} from '@venture-advisor-os/shared-types';

const STORAGE_FOLDER_NAME = 'storage';

export interface FileStorageAdapterOptions {
  storageRootDirectory: string;
}

export interface StoredArtifactRef {
  relativePath: string;
  absolutePath: string;
  sizeBytes: number;
}

export interface ResolvedCaseStorageManifest extends CaseStorageManifest {
  absoluteRoot: string;
  absoluteCaseFile: string;
  absoluteApprovedBusinessSummaryFile: string;
  absoluteFinalBusinessPlanFile: string;
  absolutePrdFile: string;
  absolutePocSpecFile: string;
  absoluteImplementationHandoffFile: string;
  absoluteCodexExecutionPlanFile: string;
}

export interface ResolvedIterationStorageManifest extends IterationStorageManifest {
  absoluteRoot: string;
  absoluteInputsRoot: string;
  absoluteOutputsRoot: string;
  absoluteRawRoot: string;
}

export interface FileStorageAdapter {
  getCaseManifest(caseId: string): ResolvedCaseStorageManifest;
  getIterationManifest(
    caseId: string,
    iterationNo: number,
  ): ResolvedIterationStorageManifest;
  ensureCaseWorkspace(caseId: string, iterationNo?: number): Promise<void>;
  writeCaseSnapshot(
    caseId: string,
    content: unknown,
  ): Promise<StoredArtifactRef>;
  writeApprovedBusinessSummary(
    caseId: string,
    content: unknown,
  ): Promise<StoredArtifactRef>;
  writeFinalBusinessPlan(
    caseId: string,
    markdown: string,
  ): Promise<StoredArtifactRef>;
  writePrd(caseId: string, markdown: string): Promise<StoredArtifactRef>;
  writePocSpec(caseId: string, markdown: string): Promise<StoredArtifactRef>;
  writeImplementationHandoff(
    caseId: string,
    content: unknown,
  ): Promise<StoredArtifactRef>;
  writeCodexExecutionPlan(
    caseId: string,
    markdown: string,
  ): Promise<StoredArtifactRef>;
  writeIterationInput(
    caseId: string,
    iterationNo: number,
    fileName: string,
    content: string | unknown,
  ): Promise<StoredArtifactRef>;
  writeIterationOutput(
    caseId: string,
    iterationNo: number,
    outputKey: keyof typeof ITERATION_OUTPUT_FILE_NAMES,
    content: string | unknown,
  ): Promise<StoredArtifactRef>;
  writeIterationRaw(
    caseId: string,
    iterationNo: number,
    rawKey: keyof typeof ITERATION_RAW_FILE_NAMES,
    content: string | unknown,
  ): Promise<StoredArtifactRef>;
  readText(relativePath: string): Promise<string | null>;
  readJson<TValue>(relativePath: string): Promise<TValue | null>;
  listCaseArtifacts(caseId: string): Promise<StoredArtifactRef[]>;
  deleteCaseWorkspace(caseId: string): Promise<void>;
}

export function createFileStorageAdapter(
  options: FileStorageAdapterOptions,
): FileStorageAdapter {
  const storageRootDirectory = resolve(options.storageRootDirectory);

  return {
    getCaseManifest(caseId) {
      return resolveCaseManifest(storageRootDirectory, caseId);
    },
    getIterationManifest(caseId, iterationNo) {
      return resolveIterationManifest(
        storageRootDirectory,
        caseId,
        iterationNo,
      );
    },
    async ensureCaseWorkspace(caseId, iterationNo) {
      const caseManifest = resolveCaseManifest(storageRootDirectory, caseId);
      await mkdir(caseManifest.absoluteRoot, { recursive: true });

      if (iterationNo !== undefined) {
        const iterationManifest = resolveIterationManifest(
          storageRootDirectory,
          caseId,
          iterationNo,
        );
        await Promise.all([
          mkdir(iterationManifest.absoluteInputsRoot, { recursive: true }),
          mkdir(iterationManifest.absoluteOutputsRoot, { recursive: true }),
          mkdir(iterationManifest.absoluteRawRoot, { recursive: true }),
        ]);
      }
    },
    writeCaseSnapshot(caseId, content) {
      const manifest = resolveCaseManifest(storageRootDirectory, caseId);
      return writeManagedFile(
        manifest.caseFile,
        manifest.absoluteCaseFile,
        content,
      );
    },
    writeApprovedBusinessSummary(caseId, content) {
      const manifest = resolveCaseManifest(storageRootDirectory, caseId);
      return writeManagedFile(
        manifest.approvedBusinessSummaryFile,
        manifest.absoluteApprovedBusinessSummaryFile,
        content,
      );
    },
    writeFinalBusinessPlan(caseId, markdown) {
      const manifest = resolveCaseManifest(storageRootDirectory, caseId);
      return writeManagedFile(
        manifest.finalBusinessPlanFile,
        manifest.absoluteFinalBusinessPlanFile,
        markdown,
      );
    },
    writePrd(caseId, markdown) {
      const manifest = resolveCaseManifest(storageRootDirectory, caseId);
      return writeManagedFile(
        manifest.prdFile,
        manifest.absolutePrdFile,
        markdown,
      );
    },
    writePocSpec(caseId, markdown) {
      const manifest = resolveCaseManifest(storageRootDirectory, caseId);
      return writeManagedFile(
        manifest.pocSpecFile,
        manifest.absolutePocSpecFile,
        markdown,
      );
    },
    writeImplementationHandoff(caseId, content) {
      const manifest = resolveCaseManifest(storageRootDirectory, caseId);
      return writeManagedFile(
        manifest.implementationHandoffFile,
        manifest.absoluteImplementationHandoffFile,
        content,
      );
    },
    writeCodexExecutionPlan(caseId, markdown) {
      const manifest = resolveCaseManifest(storageRootDirectory, caseId);
      return writeManagedFile(
        manifest.codexExecutionPlanFile,
        manifest.absoluteCodexExecutionPlanFile,
        markdown,
      );
    },
    writeIterationInput(caseId, iterationNo, fileName, content) {
      const manifest = resolveIterationManifest(
        storageRootDirectory,
        caseId,
        iterationNo,
      );
      const safeFileName = normalizeCaseRelativeFileName(fileName);
      const relativePath = `${manifest.inputsRoot}/${safeFileName}`;
      const absolutePath = resolveManagedAbsolutePath(
        storageRootDirectory,
        relativePath,
      );
      return writeManagedFile(relativePath, absolutePath, content);
    },
    writeIterationOutput(caseId, iterationNo, outputKey, content) {
      const manifest = resolveIterationManifest(
        storageRootDirectory,
        caseId,
        iterationNo,
      );
      const relativePath = manifest.outputFiles[outputKey];
      const absolutePath = resolveManagedAbsolutePath(
        storageRootDirectory,
        relativePath,
      );
      return writeManagedFile(relativePath, absolutePath, content);
    },
    writeIterationRaw(caseId, iterationNo, rawKey, content) {
      const manifest = resolveIterationManifest(
        storageRootDirectory,
        caseId,
        iterationNo,
      );
      const relativePath = manifest.rawFiles[rawKey];
      const absolutePath = resolveManagedAbsolutePath(
        storageRootDirectory,
        relativePath,
      );
      return writeManagedFile(relativePath, absolutePath, content);
    },
    async readText(relativePath) {
      const absolutePath = resolveManagedAbsolutePath(
        storageRootDirectory,
        relativePath,
      );

      try {
        return await readFile(absolutePath, 'utf8');
      } catch (error) {
        if (isFileNotFoundError(error)) {
          return null;
        }

        throw error;
      }
    },
    async readJson<TValue>(relativePath: string) {
      const text = await this.readText(relativePath);
      return text === null ? null : (JSON.parse(text) as TValue);
    },
    async listCaseArtifacts(caseId) {
      const manifest = resolveCaseManifest(storageRootDirectory, caseId);

      try {
        return await collectArtifacts(
          storageRootDirectory,
          manifest.absoluteRoot,
        );
      } catch (error) {
        if (isFileNotFoundError(error)) {
          return [];
        }

        throw error;
      }
    },
    async deleteCaseWorkspace(caseId) {
      const manifest = resolveCaseManifest(storageRootDirectory, caseId);
      await rm(manifest.absoluteRoot, { force: true, recursive: true });
    },
  };
}

function resolveCaseManifest(
  storageRootDirectory: string,
  caseId: string,
): ResolvedCaseStorageManifest {
  const manifest = createCaseStorageManifest(caseId);

  return {
    ...manifest,
    absoluteRoot: resolveManagedAbsolutePath(
      storageRootDirectory,
      manifest.root,
      false,
    ),
    absoluteCaseFile: resolveManagedAbsolutePath(
      storageRootDirectory,
      manifest.caseFile,
    ),
    absoluteApprovedBusinessSummaryFile: resolveManagedAbsolutePath(
      storageRootDirectory,
      manifest.approvedBusinessSummaryFile,
    ),
    absoluteFinalBusinessPlanFile: resolveManagedAbsolutePath(
      storageRootDirectory,
      manifest.finalBusinessPlanFile,
    ),
    absolutePrdFile: resolveManagedAbsolutePath(
      storageRootDirectory,
      manifest.prdFile,
    ),
    absolutePocSpecFile: resolveManagedAbsolutePath(
      storageRootDirectory,
      manifest.pocSpecFile,
    ),
    absoluteImplementationHandoffFile: resolveManagedAbsolutePath(
      storageRootDirectory,
      manifest.implementationHandoffFile,
    ),
    absoluteCodexExecutionPlanFile: resolveManagedAbsolutePath(
      storageRootDirectory,
      manifest.codexExecutionPlanFile,
    ),
  };
}

function resolveIterationManifest(
  storageRootDirectory: string,
  caseId: string,
  iterationNo: number,
): ResolvedIterationStorageManifest {
  const manifest = createIterationStorageManifest(caseId, iterationNo);

  return {
    ...manifest,
    absoluteRoot: resolveManagedAbsolutePath(
      storageRootDirectory,
      manifest.root,
      false,
    ),
    absoluteInputsRoot: resolveManagedAbsolutePath(
      storageRootDirectory,
      manifest.inputsRoot,
      false,
    ),
    absoluteOutputsRoot: resolveManagedAbsolutePath(
      storageRootDirectory,
      manifest.outputsRoot,
      false,
    ),
    absoluteRawRoot: resolveManagedAbsolutePath(
      storageRootDirectory,
      manifest.rawRoot,
      false,
    ),
  };
}

async function writeManagedFile(
  relativePath: string,
  absolutePath: string,
  content: string | unknown,
): Promise<StoredArtifactRef> {
  assertAllowedRelativePath(relativePath);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, serializeContent(content), 'utf8');

  const fileStat = await stat(absolutePath);

  return {
    relativePath: normalizeStoragePath(relativePath),
    absolutePath,
    sizeBytes: fileStat.size,
  };
}

async function collectArtifacts(
  storageRootDirectory: string,
  directoryPath: string,
): Promise<StoredArtifactRef[]> {
  const entries = await readdir(directoryPath, { withFileTypes: true });
  const artifacts: StoredArtifactRef[] = [];

  for (const entry of entries) {
    const absolutePath = resolve(directoryPath, entry.name);

    if (entry.isDirectory()) {
      artifacts.push(
        ...(await collectArtifacts(storageRootDirectory, absolutePath)),
      );
      continue;
    }

    const fileStat = await stat(absolutePath);
    const relativePath = normalizeStoragePath(
      `${STORAGE_FOLDER_NAME}/${relative(storageRootDirectory, absolutePath)}`,
    );

    artifacts.push({
      relativePath,
      absolutePath,
      sizeBytes: fileStat.size,
    });
  }

  return artifacts.sort((left, right) =>
    left.relativePath.localeCompare(right.relativePath),
  );
}

function resolveManagedAbsolutePath(
  storageRootDirectory: string,
  relativePath: string,
  requireAllowlistedPath = true,
): string {
  const normalizedRelativePath = normalizeStoragePath(relativePath);
  if (requireAllowlistedPath) {
    assertAllowedRelativePath(normalizedRelativePath);
  }

  const relativePathWithinStorage = normalizedRelativePath.startsWith(
    `${STORAGE_FOLDER_NAME}/`,
  )
    ? normalizedRelativePath.slice(STORAGE_FOLDER_NAME.length + 1)
    : normalizedRelativePath;
  const absolutePath = resolve(storageRootDirectory, relativePathWithinStorage);

  const relativeToStorageRoot = normalizeStoragePath(
    relative(storageRootDirectory, absolutePath),
  );
  if (
    relativeToStorageRoot.startsWith('../') ||
    relativeToStorageRoot === '..'
  ) {
    throw new Error(`Storage path escapes the managed root: ${relativePath}`);
  }

  return absolutePath;
}

function normalizeCaseRelativeFileName(fileName: string): string {
  const normalizedFileName = normalizeStoragePath(fileName);
  if (
    normalizedFileName.length === 0 ||
    normalizedFileName.split('/').includes('..')
  ) {
    throw new Error(`Invalid case-relative file name: ${fileName}`);
  }

  return normalizedFileName;
}

function assertAllowedRelativePath(relativePath: string): void {
  if (!isAllowedStorageRelativePath(relativePath)) {
    throw new Error(`Storage path is not allowlisted: ${relativePath}`);
  }
}

function serializeContent(content: string | unknown): string {
  return typeof content === 'string'
    ? content
    : `${JSON.stringify(content, null, 2)}\n`;
}

function isFileNotFoundError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ENOENT'
  );
}
