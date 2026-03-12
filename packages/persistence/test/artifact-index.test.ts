import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createArtifactIndexService,
  createFileStorageAdapter,
} from '../src/index.js';

describe('artifact index service', () => {
  const storageRoots: string[] = [];

  afterEach(async () => {
    for (const storageRoot of storageRoots.splice(0)) {
      await createFileStorageAdapter({
        storageRootDirectory: storageRoot,
      }).deleteCaseWorkspace('case-1');
    }
  });

  it('returns latest root artifacts plus latest iteration raw and normalized outputs', async () => {
    const storageRoot = await mkdtemp(join(tmpdir(), 'venture-advisor-os-'));
    storageRoots.push(storageRoot);

    const storage = createFileStorageAdapter({
      storageRootDirectory: storageRoot,
    });
    const artifactIndex = createArtifactIndexService(storage);

    await storage.ensureCaseWorkspace('case-1', 2);
    await storage.writeApprovedBusinessSummary('case-1', { summary: 'ok' });
    await storage.writeFinalBusinessPlan('case-1', '# Business plan');
    await storage.writePrd('case-1', '# PRD');
    await storage.writePocSpec('case-1', '# POC');
    await storage.writeImplementationHandoff('case-1', { handoff: true });
    await storage.writeCodexExecutionPlan('case-1', '# Codex Execution Plan');
    await storage.writeIterationOutput('case-1', 2, 'marketFacts', '# Facts');
    await storage.writeIterationOutput('case-1', 2, 'judgeDecision', {
      decision: 'PASS',
    });
    await storage.writeIterationRaw('case-1', 2, 'factResearcher', {
      raw: 'source output',
    });

    const artifacts = await artifactIndex.listLatestOutputArtifacts('case-1', 2);

    expect(artifacts).toEqual([
      {
        name: 'approved_business_summary.json',
        path: 'storage/cases/case-1/approved_business_summary.json',
        kind: 'approved-business-summary',
      },
      {
        name: 'final_business_plan.md',
        path: 'storage/cases/case-1/final_business_plan.md',
        kind: 'business-plan',
      },
      {
        name: 'prd.md',
        path: 'storage/cases/case-1/prd.md',
        kind: 'prd',
      },
      {
        name: 'poc_spec.md',
        path: 'storage/cases/case-1/poc_spec.md',
        kind: 'poc',
      },
      {
        name: 'implementation_handoff.json',
        path: 'storage/cases/case-1/implementation_handoff.json',
        kind: 'handoff',
      },
      {
        name: 'codex_execution_plan.md',
        path: 'storage/cases/case-1/codex_execution_plan.md',
        kind: 'codex-execution-plan',
      },
      {
        name: 'market_facts.md',
        path: 'storage/cases/case-1/iterations/2/outputs/market_facts.md',
        kind: 'normalized-output',
      },
      {
        name: 'judge_decision.json',
        path: 'storage/cases/case-1/iterations/2/outputs/judge_decision.json',
        kind: 'normalized-output',
      },
      {
        name: 'fact_researcher.raw.json',
        path: 'storage/cases/case-1/iterations/2/raw/fact_researcher.raw.json',
        kind: 'raw-output',
      },
    ]);
  });
});
