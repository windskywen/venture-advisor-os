import type {
  BrowsingAutonomy,
  ResearchStyle,
} from '@venture-advisor-os/shared-types';

export interface ResearchQuery {
  topic: string;
  region?: string;
  requestedAt: string;
  maxResults?: number;
  researchStyle?: ResearchStyle;
  browsingAutonomy?: BrowsingAutonomy;
}

export interface ResearchCitationMetadata {
  label: string;
  url: string;
  publishedAt?: string;
  retrievedAt: string;
}

export interface ResearchSourceRecord {
  title: string;
  snippet: string;
  sourceType: 'article' | 'report' | 'dataset' | 'other';
  citation: ResearchCitationMetadata;
  freshnessDays?: number;
}

export interface ResearchFinding {
  claim: string;
  facts: string[];
  sources: ResearchSourceRecord[];
}

export interface ResearchReport {
  query: ResearchQuery;
  findings: ResearchFinding[];
}

export interface ResearchTool {
  search(query: ResearchQuery): Promise<ResearchReport>;
}

export type ResearchSearchHandler = (
  query: ResearchQuery,
) => Promise<ResearchReport> | ResearchReport;

export function createResearchTool(handler: ResearchSearchHandler): ResearchTool {
  return {
    async search(query) {
      const report = await handler(query);

      return {
        ...report,
        findings: report.findings.map((finding) => ({
          ...finding,
          sources: finding.sources.map((source) => ({
            ...source,
            freshnessDays: computeFreshnessDays(
              source.citation.publishedAt,
              source.citation.retrievedAt,
            ),
          })),
        })),
      };
    },
  };
}

function computeFreshnessDays(
  publishedAt: string | undefined,
  retrievedAt: string,
): number | undefined {
  if (!publishedAt) {
    return undefined;
  }

  const published = new Date(publishedAt).getTime();
  const retrieved = new Date(retrievedAt).getTime();
  const millisecondsPerDay = 24 * 60 * 60 * 1000;

  return Math.max(0, Math.floor((retrieved - published) / millisecondsPerDay));
}
