import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import pg from 'pg';
import { describe, expect, it } from 'vitest';

import { createPersistenceRepositories } from '../src/index.js';

const { Client } = pg;
const databaseUrl = loadEnvironmentValue('DATABASE_URL');

const describeIfDatabase = databaseUrl ? describe : describe.skip;

describeIfDatabase('persistence repositories integration', () => {
  it('round-trips case and founder-value records against PostgreSQL', async () => {
    const client = new Client({
      connectionString: databaseUrl,
    });
    await client.connect();

    try {
      await client.query('BEGIN');

      const repositories = createPersistenceRepositories(client);
      const caseId = `integration-case-${randomUUID()}`;

      await repositories.cases.create({
        caseId,
        topic: 'AI bookkeeping',
        preferredBusinessModels: ['SaaS'],
        constraints: ['Keep onboarding simple'],
        status: 'TOPIC_ACCEPTED',
        currentIteration: 0,
        maxIterations: 3,
        manualReviewRequired: false,
        createdAt: '2026-03-12T10:00:00.000Z',
        updatedAt: '2026-03-12T10:00:00.000Z',
      });
      await repositories.founderValueMeasurements.create({
        measurementId: `measurement-${randomUUID()}`,
        caseId,
        respondentType: 'OPERATOR',
        actor: 'operator',
        perceivedUsefulnessScore: 4,
        confidenceIncreaseScore: 5,
        manualResearchMinutesSaved: 90,
        notes: 'Good first-pass validation aid.',
        createdAt: '2026-03-12T10:30:00.000Z',
      });

      const caseRecord = await repositories.cases.getById(caseId);
      const measurements =
        await repositories.founderValueMeasurements.listByCaseId(caseId);

      expect(caseRecord).toMatchObject({
        caseId,
        status: 'TOPIC_ACCEPTED',
      });
      expect(measurements).toHaveLength(1);
      expect(measurements[0]).toMatchObject({
        caseId,
        respondentType: 'OPERATOR',
        perceivedUsefulnessScore: 4,
        confidenceIncreaseScore: 5,
        manualResearchMinutesSaved: 90,
      });
    } finally {
      await client.query('ROLLBACK').catch(() => undefined);
      await client.end();
    }
  });
});

function loadEnvironmentValue(name: string): string | undefined {
  const envFilePath = resolve(process.cwd(), '.env');
  const fileEnv = loadDotEnv(envFilePath);
  const value = fileEnv[name] ?? process.env[name];

  return typeof value === 'string' && value.trim().length > 0
    ? value
    : undefined;
}

function loadDotEnv(path: string): Record<string, string> {
  if (!existsSync(path)) {
    return {};
  }

  const parsed: Record<string, string> = {};
  const lines = readFileSync(path, 'utf8').split(/\r?\n/u);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.length === 0 || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    parsed[line.slice(0, separatorIndex).trim()] = line
      .slice(separatorIndex + 1)
      .trim();
  }

  return parsed;
}
