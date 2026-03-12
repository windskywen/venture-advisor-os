import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const projectRoot = process.cwd();
const replacements = [
  {
    filePath: resolve(
      projectRoot,
      'node_modules/@github/copilot-sdk/dist/session.js',
    ),
    from: '"vscode-jsonrpc/node"',
    to: '"vscode-jsonrpc/node.js"',
  },
  {
    filePath: resolve(
      projectRoot,
      'node_modules/@github/copilot-sdk/dist/session.d.ts',
    ),
    from: '"vscode-jsonrpc/node"',
    to: '"vscode-jsonrpc/node.js"',
  },
];

for (const replacement of replacements) {
  if (!existsSync(replacement.filePath)) {
    continue;
  }

  const original = readFileSync(replacement.filePath, 'utf8');
  if (!original.includes(replacement.from)) {
    continue;
  }

  writeFileSync(
    replacement.filePath,
    original.replaceAll(replacement.from, replacement.to),
    'utf8',
  );
}
