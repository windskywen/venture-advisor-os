import { isAbsolute, resolve } from 'node:path';

const PROJECT_ALIAS_PATTERN = /^[a-z][a-z0-9_-]*$/u;

export interface ProjectAliasRegistry {
  aliases: Record<string, string>;
  resolve(alias: string): string;
}

export function createProjectAliasRegistry(
  aliases: Record<string, string>,
): ProjectAliasRegistry {
  const normalizedAliases = Object.fromEntries(
    Object.entries(aliases).map(([alias, directoryPath]) => [
      normalizeProjectAlias(alias),
      normalizeAllowlistedDirectory(directoryPath),
    ]),
  );

  return {
    aliases: normalizedAliases,
    resolve(alias) {
      const normalizedAlias = normalizeProjectAlias(alias);
      const directoryPath = normalizedAliases[normalizedAlias];
      if (!directoryPath) {
        throw new Error(`Unknown project alias: ${normalizedAlias}`);
      }

      return directoryPath;
    },
  };
}

export function normalizeProjectAlias(alias: string): string {
  const normalizedAlias = alias.trim().toLowerCase();
  if (!PROJECT_ALIAS_PATTERN.test(normalizedAlias)) {
    throw new Error(
      `Project alias must match ${PROJECT_ALIAS_PATTERN.source} and cannot be a filesystem path.`,
    );
  }

  if (
    normalizedAlias.includes('/') ||
    normalizedAlias.includes('\\') ||
    normalizedAlias.includes(':')
  ) {
    throw new Error('Project alias cannot contain path separators.');
  }

  return normalizedAlias;
}

export function normalizeAllowlistedDirectory(directoryPath: string): string {
  const trimmedDirectoryPath = directoryPath.trim();
  if (!isAbsolute(trimmedDirectoryPath)) {
    throw new Error(
      `Project alias directories must be absolute. Received: ${directoryPath}`,
    );
  }

  return resolve(trimmedDirectoryPath);
}
