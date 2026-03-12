import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve, relative } from 'node:path';

const rootDirectory = process.cwd();
const sourceRoots = ['apps', 'packages'];
const appPackageNames = new Set([
  '@venture-advisor-os/gateway-api',
  '@venture-advisor-os/telegram-bot',
  '@venture-advisor-os/worker',
]);
const adapterPrefixes = [
  'apps/gateway-api/src/adapters/',
  'apps/telegram-bot/src/adapters/',
];
const adapterAllowedPackageImports = new Set([
  '@venture-advisor-os/shared-types',
]);
const errors = [];

for (const sourceRoot of sourceRoots) {
  for (const filePath of collectTypeScriptFiles(
    resolve(rootDirectory, sourceRoot),
  )) {
    validateFile(filePath);
  }
}

if (errors.length > 0) {
  console.error('Ownership boundary validation failed:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log('Ownership boundaries validated.');

function collectTypeScriptFiles(directory) {
  const files = [];

  for (const entry of readdirSync(directory)) {
    const fullPath = resolve(directory, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      files.push(...collectTypeScriptFiles(fullPath));
      continue;
    }

    if (fullPath.endsWith('.ts')) {
      files.push(fullPath);
    }
  }

  return files;
}

function validateFile(filePath) {
  const relativePath = toRelativePath(filePath);
  const source = readFileSync(filePath, 'utf8');
  const importSpecifiers = [
    ...source.matchAll(/^\s*import(?:.+?from\s+)?['"]([^'"]+)['"]/gmu),
    ...source.matchAll(/^\s*export.+?from\s+['"]([^'"]+)['"]/gmu),
  ].map((match) => match[1]);

  for (const importSpecifier of importSpecifiers) {
    if (
      relativePath.startsWith('packages/') &&
      appPackageNames.has(importSpecifier)
    ) {
      errors.push(
        `${relativePath} must not import app package "${importSpecifier}". Shared packages must stay app-agnostic.`,
      );
    }

    if (
      adapterPrefixes.some((prefix) => relativePath.startsWith(prefix)) &&
      importSpecifier.startsWith('@venture-advisor-os/') &&
      !adapterAllowedPackageImports.has(importSpecifier)
    ) {
      errors.push(
        `${relativePath} must not import "${importSpecifier}" directly. Adapter code must go through the local app layer.`,
      );
    }
  }
}

function toRelativePath(filePath) {
  return relative(rootDirectory, filePath).replaceAll('\\', '/');
}
