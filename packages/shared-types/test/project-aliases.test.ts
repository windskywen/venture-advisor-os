import { describe, expect, it } from 'vitest';

import {
  createProjectAliasRegistry,
  normalizeAllowlistedDirectory,
  normalizeProjectAlias,
} from '../src/index.js';

describe('project alias registry', () => {
  it('resolves only registered aliases to absolute allowlisted directories', () => {
    const registry = createProjectAliasRegistry({
      core_repo: 'C:\\Users\\IvanWen\\source\\projects\\venture-advisor-os',
      docs_repo: 'C:\\Users\\IvanWen\\source\\projects\\venture-advisor-os\\docs',
    });

    expect(registry.resolve('CORE_REPO')).toBe(
      normalizeAllowlistedDirectory(
        'C:\\Users\\IvanWen\\source\\projects\\venture-advisor-os',
      ),
    );
    expect(registry.resolve('docs_repo')).toBe(
      normalizeAllowlistedDirectory(
        'C:\\Users\\IvanWen\\source\\projects\\venture-advisor-os\\docs',
      ),
    );
  });

  it('rejects path-like alias input so raw OS paths cannot be used as aliases', () => {
    expect(() => normalizeProjectAlias('C:\\repo')).toThrow(
      'filesystem path',
    );
    expect(() => normalizeProjectAlias('../repo')).toThrow('filesystem path');
    expect(() => normalizeProjectAlias('repo/subdir')).toThrow(
      'filesystem path',
    );
  });

  it('rejects non-absolute allowlist directories', () => {
    expect(() => normalizeAllowlistedDirectory('.\\relative')).toThrow(
      'must be absolute',
    );
  });
});
