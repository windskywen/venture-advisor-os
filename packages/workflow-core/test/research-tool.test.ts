import { describe, expect, it } from 'vitest';

import { createResearchTool } from '../src/index.js';

describe('research tool abstraction', () => {
  it('returns normalized findings with citation metadata and freshness tracking', async () => {
    const tool = createResearchTool((query) => ({
      query,
      findings: [
        {
          claim: 'Consultancies spend significant time on manual notes.',
          facts: ['Manual note capture remains a workflow bottleneck.'],
          sources: [
            {
              title: 'Industry report',
              snippet: 'Consultants spend hours documenting meetings.',
              sourceType: 'report',
              citation: {
                label: '[1]',
                url: 'https://example.com/report',
                publishedAt: '2026-03-01T00:00:00.000Z',
                retrievedAt: '2026-03-10T00:00:00.000Z',
              },
            },
          ],
        },
      ],
    }));

    const report = await tool.search({
      topic: 'AI note-taking for consultants',
      requestedAt: '2026-03-10T00:00:00.000Z',
    });

    expect(report.findings[0]?.sources[0]).toMatchObject({
      title: 'Industry report',
      freshnessDays: 9,
      citation: {
        label: '[1]',
        url: 'https://example.com/report',
      },
    });
  });
});
