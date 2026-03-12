import { describe, expect, it, vi } from 'vitest';

import { createResearchTool } from '@venture-advisor-os/workflow-core';

import { createLiveWebResearchTool } from '../src/web-research-tool.js';

describe('createLiveWebResearchTool', () => {
  it('builds live findings from DuckDuckGo results and source pages', async () => {
    const fetchImpl = vi.fn(async (input: string | URL) => {
      const url = String(input);

      if (url.startsWith('https://html.duckduckgo.com/html/?q=')) {
        return new Response(
          `
            <html>
              <body>
                <div class="result">
                  <a
                    class="result__a"
                    href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fresearch%2Fai-bookkeeping"
                  >
                    AI bookkeeping is reshaping freelance finance workflows
                  </a>
                  <a class="result__snippet">
                    Jan 12, 2026 Freelancers are turning to AI accounting copilots for reconciliation and invoice cleanup.
                  </a>
                </div>
              </body>
            </html>
          `,
          {
            status: 200,
            headers: {
              'content-type': 'text/html; charset=utf-8',
            },
          },
        );
      }

      if (url === 'https://example.com/research/ai-bookkeeping') {
        return new Response(
          `
            <html>
              <head>
                <title>AI bookkeeping is reshaping freelance finance workflows</title>
                <meta
                  name="description"
                  content="A 2026 benchmark found that freelancers still spend hours each week on reconciliation and invoice follow-up."
                />
                <meta
                  property="article:published_time"
                  content="2026-01-12T09:00:00.000Z"
                />
              </head>
              <body>
                <article>
                  A 2026 benchmark found that freelancers still spend hours each week on reconciliation and invoice follow-up.
                </article>
              </body>
            </html>
          `,
          {
            status: 200,
            headers: {
              'content-type': 'text/html; charset=utf-8',
            },
          },
        );
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    const tool = createLiveWebResearchTool({
      fetchImpl: fetchImpl as typeof fetch,
      maxSearchQueries: 1,
      maxResultsPerQuery: 1,
    });

    const report = await tool.search({
      topic: 'AI bookkeeping for freelancers',
      requestedAt: '2026-03-13T00:00:00.000Z',
      researchStyle: 'BALANCED',
      browsingAutonomy: {
        profile: 'STANDARD',
        allowAdjacentExploration: false,
        allowCompetitorExploration: true,
        allowOpenEndedQueries: false,
        maxSources: 3,
        recencyWindowDays: 120,
      },
    });

    expect(report.findings).toHaveLength(1);
    expect(report.findings[0]?.claim).toBe(
      'AI bookkeeping is reshaping freelance finance workflows',
    );
    expect(report.findings[0]?.sources[0]).toMatchObject({
      title: 'AI bookkeeping is reshaping freelance finance workflows',
      sourceType: 'article',
      citation: {
        url: 'https://example.com/research/ai-bookkeeping',
        publishedAt: '2026-01-12T09:00:00.000Z',
        retrievedAt: '2026-03-13T00:00:00.000Z',
      },
    });
    expect(report.findings[0]?.facts[0]).toContain(
      'freelancers still spend hours each week on reconciliation',
    );
  });

  it('falls back to the deterministic research tool when live search fails', async () => {
    const fallbackTool = createResearchTool((query) => ({
      query,
      findings: [
        {
          claim: 'Fallback research finding',
          facts: ['Used deterministic fallback after live web search failed.'],
          sources: [
            {
              title: 'Fallback source',
              snippet: 'Fallback source summary.',
              sourceType: 'report',
              citation: {
                label: '[1]',
                url: 'https://example.com/fallback',
                retrievedAt: query.requestedAt,
              },
            },
          ],
        },
      ],
    }));

    const tool = createLiveWebResearchTool({
      fetchImpl: vi.fn(async () => new Response('search unavailable', { status: 503 })) as typeof fetch,
      fallbackTool,
    });

    const report = await tool.search({
      topic: 'AI bookkeeping for freelancers',
      requestedAt: '2026-03-13T00:00:00.000Z',
    });

    expect(report.findings[0]?.claim).toBe('Fallback research finding');
  });
});
