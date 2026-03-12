import { load as loadHtml } from 'cheerio';

import type {
  BrowsingAutonomy,
  ResearchStyle,
} from '@venture-advisor-os/shared-types';
import {
  createResearchTool,
  type ResearchFinding,
  type ResearchQuery,
  type ResearchSourceRecord,
  type ResearchTool,
} from '@venture-advisor-os/workflow-core';

const DEFAULT_SEARCH_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36';
const DEFAULT_MAX_SEARCH_QUERIES = 4;
const DEFAULT_RESULTS_PER_QUERY = 4;
const SEARCH_TIMEOUT_MS = 12_000;
const PAGE_TIMEOUT_MS = 12_000;
const MAX_SNIPPET_LENGTH = 320;
const MAX_FACTS_PER_FINDING = 2;

export interface LiveWebResearchToolOptions {
  fetchImpl?: typeof fetch;
  fallbackTool?: ResearchTool;
  userAgent?: string;
  maxSearchQueries?: number;
  maxResultsPerQuery?: number;
}

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  query: string;
  rank: number;
  publishedAtHint?: string;
}

interface EnrichedSearchResult {
  title: string;
  url: string;
  snippet: string;
  sourceType: ResearchSourceRecord['sourceType'];
  publishedAt?: string;
  rank: number;
}

export function createLiveWebResearchTool(
  options: LiveWebResearchToolOptions = {},
): ResearchTool {
  const fetchImpl = options.fetchImpl ?? fetch;
  const userAgent = options.userAgent ?? DEFAULT_SEARCH_USER_AGENT;

  return createResearchTool(async (query) => {
    try {
      return await executeLiveResearchSearch({
        query,
        fetchImpl,
        userAgent,
        maxSearchQueries:
          options.maxSearchQueries ?? DEFAULT_MAX_SEARCH_QUERIES,
        maxResultsPerQuery:
          options.maxResultsPerQuery ?? DEFAULT_RESULTS_PER_QUERY,
      });
    } catch (error) {
      if (!options.fallbackTool) {
        throw error;
      }

      return options.fallbackTool.search(query);
    }
  });
}

async function executeLiveResearchSearch(input: {
  query: ResearchQuery;
  fetchImpl: typeof fetch;
  userAgent: string;
  maxSearchQueries: number;
  maxResultsPerQuery: number;
}) {
  const searchQueries = buildSearchQueries(
    input.query,
    input.maxSearchQueries,
  );
  const rawResults: SearchResult[] = [];

  for (const searchQuery of searchQueries) {
    const results = await searchDuckDuckGo({
      fetchImpl: input.fetchImpl,
      userAgent: input.userAgent,
      searchQuery,
      limit: input.maxResultsPerQuery,
    });
    rawResults.push(...results);
  }

  const uniqueResults = dedupeSearchResults(rawResults);
  if (uniqueResults.length === 0) {
    throw new Error(
      `Live web research returned no search results for "${input.query.topic}".`,
    );
  }

  const maxSources = resolveMaxSources(input.query);
  const enrichedResults = await enrichSearchResults({
    results: uniqueResults,
    query: input.query,
    fetchImpl: input.fetchImpl,
    userAgent: input.userAgent,
  });

  if (enrichedResults.length === 0) {
    throw new Error(
      `Live web research returned no usable source pages for "${input.query.topic}".`,
    );
  }

  const rankedResults = rankEnrichedResults(enrichedResults, input.query).slice(
    0,
    maxSources,
  );
  const findings = rankedResults.map((result, index) =>
    buildFinding(result, input.query.requestedAt, index + 1),
  );

  return {
    query: {
      ...input.query,
      maxResults: maxSources,
    },
    findings,
  };
}

function buildSearchQueries(
  query: ResearchQuery,
  maxQueries: number,
): string[] {
  const topic = query.topic.trim();
  const regionSuffix = query.region ? ` ${query.region}` : '';
  const styleQueries = resolveStyleDrivenQueries(query.researchStyle, topic);
  const browsingQueries = resolveBrowsingDrivenQueries(
    query.browsingAutonomy,
    topic,
  );
  const datedQuery = `${topic}${regionSuffix} 2025 OR 2026`;

  return Array.from(
    new Set([
      `${topic}${regionSuffix} software workflow pain points`,
      `${topic}${regionSuffix} market report`,
      ...styleQueries,
      ...browsingQueries,
      datedQuery,
    ]),
  )
    .map((value) => normalizeWhitespace(value))
    .filter((value) => value.length > 0)
    .slice(0, maxQueries);
}

function resolveStyleDrivenQueries(
  researchStyle: ResearchStyle | undefined,
  topic: string,
): string[] {
  switch (researchStyle) {
    case 'CUSTOMER_WORKFLOW':
      return [
        `${topic} customer workflow bottlenecks`,
        `${topic} manual process inefficiency`,
      ];
    case 'COMPETITOR_INTENSIVE':
      return [
        `${topic} competitors alternatives`,
        `${topic} software comparison`,
      ];
    case 'REGULATORY_RISK':
      return [
        `${topic} compliance regulation`,
        `${topic} policy requirements`,
      ];
    case 'MARKET_TIMING':
      return [
        `${topic} adoption trend`,
        `${topic} funding market timing`,
      ];
    case 'BALANCED':
    default:
      return [
        `${topic} customer pain points`,
        `${topic} competitors`,
      ];
  }
}

function resolveBrowsingDrivenQueries(
  browsingAutonomy: BrowsingAutonomy | undefined,
  topic: string,
): string[] {
  if (!browsingAutonomy) {
    return [];
  }

  const queries: string[] = [];

  if (browsingAutonomy.allowCompetitorExploration) {
    queries.push(`${topic} alternatives software`);
  }

  if (browsingAutonomy.allowAdjacentExploration) {
    queries.push(`${topic} adjacent workflow software`);
  }

  if (browsingAutonomy.allowOpenEndedQueries) {
    queries.push(`${topic} industry analysis`);
  }

  return queries;
}

async function searchDuckDuckGo(input: {
  fetchImpl: typeof fetch;
  userAgent: string;
  searchQuery: string;
  limit: number;
}): Promise<SearchResult[]> {
  const searchUrl = new URL('https://html.duckduckgo.com/html/');
  searchUrl.searchParams.set('q', input.searchQuery);

  const response = await input.fetchImpl(searchUrl, {
    headers: {
      'user-agent': input.userAgent,
      accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'accept-language': 'en-US,en;q=0.9',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(
      `DuckDuckGo search failed with status ${response.status} for "${input.searchQuery}".`,
    );
  }

  const html = await response.text();
  const $ = loadHtml(html);
  const results: SearchResult[] = [];

  $('.result').each((index, element) => {
    if (results.length >= input.limit) {
      return false;
    }

    const link = $(element).find('a.result__a').first();
    const rawHref = link.attr('href');
    const normalizedUrl = normalizeSearchResultUrl(rawHref);
    if (!normalizedUrl) {
      return undefined;
    }

    const title = normalizeWhitespace(link.text());
    if (title.length === 0) {
      return undefined;
    }

    const snippet = normalizeWhitespace(
      $(element).find('.result__snippet').first().text(),
    );

    results.push({
      title,
      url: normalizedUrl,
      snippet,
      query: input.searchQuery,
      rank: index + 1,
      publishedAtHint: extractDateFromText(snippet),
    });

    return undefined;
  });

  return results;
}

function normalizeSearchResultUrl(rawHref: string | undefined): string | null {
  if (!rawHref) {
    return null;
  }

  try {
    const normalizedHref = rawHref.startsWith('//')
      ? `https:${rawHref}`
      : rawHref;
    const url = new URL(normalizedHref, 'https://html.duckduckgo.com');
    const redirectedUrl = url.searchParams.get('uddg');
    const candidate = redirectedUrl ?? url.href;
    const parsed = new URL(candidate);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return null;
    }

    return parsed.href;
  } catch {
    return null;
  }
}

function dedupeSearchResults(results: readonly SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  const deduped: SearchResult[] = [];

  for (const result of results) {
    const key = normalizeUrlForDedup(result.url);
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(result);
  }

  return deduped;
}

async function enrichSearchResults(input: {
  results: readonly SearchResult[];
  query: ResearchQuery;
  fetchImpl: typeof fetch;
  userAgent: string;
}): Promise<EnrichedSearchResult[]> {
  const enrichedResults: EnrichedSearchResult[] = [];

  for (const result of input.results) {
    try {
      const enriched = await enrichSearchResult({
        result,
        query: input.query,
        fetchImpl: input.fetchImpl,
        userAgent: input.userAgent,
      });
      enrichedResults.push(enriched);
    } catch {
      const fallback = buildFallbackEnrichedResult(result);
      if (fallback) {
        enrichedResults.push(fallback);
      }
    }
  }

  return enrichedResults;
}

async function enrichSearchResult(input: {
  result: SearchResult;
  query: ResearchQuery;
  fetchImpl: typeof fetch;
  userAgent: string;
}): Promise<EnrichedSearchResult> {
  const response = await input.fetchImpl(input.result.url, {
    headers: {
      'user-agent': input.userAgent,
      accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'accept-language': 'en-US,en;q=0.9',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(
      `Source fetch failed with status ${response.status} for ${input.result.url}.`,
    );
  }

  const finalUrl = response.url || input.result.url;
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('text/html')) {
    return {
      title: input.result.title,
      url: finalUrl,
      snippet: clampText(input.result.snippet, MAX_SNIPPET_LENGTH),
      sourceType: classifySourceType(finalUrl, input.result.title, contentType),
      publishedAt: resolvePublishedAtWithinWindow(
        input.result.publishedAtHint,
        input.query.requestedAt,
        input.query.browsingAutonomy?.recencyWindowDays,
      ),
      rank: input.result.rank,
    };
  }

  const html = await response.text();
  const $ = loadHtml(html);
  const extractedTitle = firstNonEmpty([
    $('meta[property="og:title"]').attr('content'),
    $('meta[name="twitter:title"]').attr('content'),
    $('title').text(),
    input.result.title,
  ]);
  const description = firstNonEmpty([
    $('meta[name="description"]').attr('content'),
    $('meta[property="og:description"]').attr('content'),
    $('meta[name="twitter:description"]').attr('content'),
    extractReadableText($),
    input.result.snippet,
  ]);
  const publishedAt = resolvePublishedAtWithinWindow(
    firstNonEmpty([
      $('meta[property="article:published_time"]').attr('content'),
      $('meta[name="article:published_time"]').attr('content'),
      $('meta[name="publication_date"]').attr('content'),
      $('meta[name="parsely-pub-date"]').attr('content'),
      $('meta[itemprop="datePublished"]').attr('content'),
      $('time[datetime]').first().attr('datetime'),
      extractDatePublishedFromJsonLd(html),
      input.result.publishedAtHint,
      extractDateFromText(description),
    ]),
    input.query.requestedAt,
    input.query.browsingAutonomy?.recencyWindowDays,
  );
  const resolvedTitle = normalizeWhitespace(extractedTitle ?? input.result.title);

  return {
    title: resolvedTitle,
    url: finalUrl,
    snippet: clampText(description, MAX_SNIPPET_LENGTH),
    sourceType: classifySourceType(finalUrl, resolvedTitle, contentType),
    publishedAt,
    rank: input.result.rank,
  };
}

function buildFallbackEnrichedResult(
  result: SearchResult,
): EnrichedSearchResult | null {
  if (result.snippet.length === 0) {
    return null;
  }

  return {
    title: result.title,
    url: result.url,
    snippet: clampText(result.snippet, MAX_SNIPPET_LENGTH),
    sourceType: classifySourceType(result.url, result.title, 'text/html'),
    publishedAt: result.publishedAtHint,
    rank: result.rank,
  };
}

function rankEnrichedResults(
  results: readonly EnrichedSearchResult[],
  query: ResearchQuery,
): EnrichedSearchResult[] {
  return [...results].sort((left, right) => {
    const scoreDifference = scoreResult(right, query) - scoreResult(left, query);
    if (scoreDifference !== 0) {
      return scoreDifference;
    }

    return left.rank - right.rank;
  });
}

function scoreResult(result: EnrichedSearchResult, query: ResearchQuery): number {
  let score = 100 - result.rank;

  if (result.publishedAt) {
    score += 25;
    if (
      isWithinRecencyWindow(
        result.publishedAt,
        query.requestedAt,
        query.browsingAutonomy?.recencyWindowDays,
      )
    ) {
      score += 20;
    }
  }

  if (result.sourceType === 'report' || result.sourceType === 'dataset') {
    score += 5;
  }

  return score;
}

function buildFinding(
  result: EnrichedSearchResult,
  retrievedAt: string,
  citationIndex: number,
): ResearchFinding {
  const facts = [result.snippet]
    .map((fact) => normalizeWhitespace(fact))
    .filter((fact) => fact.length > 0)
    .slice(0, MAX_FACTS_PER_FINDING);

  return {
    claim: result.title,
    facts,
    sources: [
      {
        title: result.title,
        snippet: result.snippet,
        sourceType: result.sourceType,
        citation: {
          label: `[${citationIndex}]`,
          url: result.url,
          publishedAt: result.publishedAt,
          retrievedAt,
        },
      },
    ],
  };
}

function resolveMaxSources(query: ResearchQuery): number {
  return Math.max(
    1,
    Math.min(query.maxResults ?? query.browsingAutonomy?.maxSources ?? 5, 8),
  );
}

function resolvePublishedAtWithinWindow(
  candidate: string | undefined,
  requestedAt: string,
  recencyWindowDays: number | undefined,
): string | undefined {
  const normalized = normalizePublishedAt(candidate);
  if (!normalized) {
    return undefined;
  }

  if (
    recencyWindowDays !== undefined &&
    !isWithinRecencyWindow(normalized, requestedAt, recencyWindowDays)
  ) {
    return undefined;
  }

  return normalized;
}

function normalizePublishedAt(candidate: string | undefined): string | undefined {
  if (!candidate) {
    return undefined;
  }

  const trimmed = candidate.trim();
  if (trimmed.length === 0) {
    return undefined;
  }

  const date = new Date(trimmed);
  if (!Number.isNaN(date.getTime())) {
    return date.toISOString();
  }

  const extracted = extractDateFromText(trimmed);
  if (!extracted) {
    return undefined;
  }

  const extractedDate = new Date(extracted);
  if (Number.isNaN(extractedDate.getTime())) {
    return undefined;
  }

  return extractedDate.toISOString();
}

function extractDatePublishedFromJsonLd(html: string): string | undefined {
  const jsonLdRegex =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/giu;

  for (const match of html.matchAll(jsonLdRegex)) {
    const payload = match[1]?.trim();
    if (!payload) {
      continue;
    }

    try {
      const parsed = JSON.parse(payload) as unknown;
      const found = findDatePublishedValue(parsed);
      if (found) {
        return found;
      }
    } catch {
      continue;
    }
  }

  return undefined;
}

function findDatePublishedValue(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      const found = findDatePublishedValue(entry);
      if (found) {
        return found;
      }
    }
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const candidate = record.datePublished;
  if (typeof candidate === 'string') {
    return candidate;
  }

  for (const nestedValue of Object.values(record)) {
    const found = findDatePublishedValue(nestedValue);
    if (found) {
      return found;
    }
  }

  return undefined;
}

function extractReadableText(
  root: ReturnType<typeof loadHtml>,
): string | undefined {
  const targetText = firstNonEmpty([
    root('article').first().text(),
    root('main').first().text(),
    root('body').text(),
  ]);

  if (!targetText) {
    return undefined;
  }

  const normalized = normalizeWhitespace(targetText);
  return normalized.length > 0
    ? clampText(normalized, MAX_SNIPPET_LENGTH)
    : undefined;
}

function classifySourceType(
  url: string,
  title: string,
  contentType: string,
): ResearchSourceRecord['sourceType'] {
  const normalizedUrl = url.toLowerCase();
  const normalizedTitle = title.toLowerCase();
  const normalizedContentType = contentType.toLowerCase();

  if (
    normalizedUrl.endsWith('.csv') ||
    normalizedUrl.endsWith('.xlsx') ||
    normalizedUrl.includes('/dataset') ||
    normalizedTitle.includes('dataset')
  ) {
    return 'dataset';
  }

  if (
    normalizedContentType.includes('pdf') ||
    normalizedUrl.endsWith('.pdf') ||
    normalizedUrl.includes('report') ||
    normalizedTitle.includes('report') ||
    normalizedTitle.includes('survey') ||
    normalizedTitle.includes('benchmark') ||
    normalizedTitle.includes('research')
  ) {
    return 'report';
  }

  return 'article';
}

function isWithinRecencyWindow(
  publishedAt: string,
  requestedAt: string,
  recencyWindowDays: number | undefined,
): boolean {
  if (recencyWindowDays === undefined) {
    return true;
  }

  const publishedTime = new Date(publishedAt).getTime();
  const requestedTime = new Date(requestedAt).getTime();
  if (Number.isNaN(publishedTime) || Number.isNaN(requestedTime)) {
    return false;
  }

  const elapsedDays = (requestedTime - publishedTime) / (24 * 60 * 60 * 1000);
  return elapsedDays <= recencyWindowDays;
}

function extractDateFromText(text: string | undefined): string | undefined {
  if (!text) {
    return undefined;
  }

  const isoMatch = text.match(/\b\d{4}-\d{2}-\d{2}(?:[T ][^ ]+)?\b/u)?.[0];
  if (isoMatch) {
    return isoMatch;
  }

  const longMonthMatch =
    text.match(
      /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?\s+\d{1,2},\s+\d{4}\b/iu,
    )?.[0];
  if (longMonthMatch) {
    return longMonthMatch;
  }

  const shortDateMatch = text.match(/\b\d{1,2}\/\d{1,2}\/\d{4}\b/u)?.[0];
  if (shortDateMatch) {
    return shortDateMatch;
  }

  return undefined;
}

function firstNonEmpty(values: readonly (string | undefined)[]): string | undefined {
  for (const value of values) {
    const normalized = normalizeWhitespace(value);
    if (normalized.length > 0) {
      return normalized;
    }
  }

  return undefined;
}

function clampText(value: string | undefined, maxLength: number): string {
  const normalized = normalizeWhitespace(value);
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
}

function normalizeWhitespace(value: string | undefined): string {
  return (value ?? '').replace(/\s+/gu, ' ').trim();
}

function normalizeUrlForDedup(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = '';
    if (parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    return parsed.href;
  } catch {
    return url;
  }
}
