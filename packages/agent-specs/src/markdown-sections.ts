import { z } from 'zod';

const MARKDOWN_HEADING_PATTERN = /^#{1,6}\s+(.+?)\s*$/gmu;
const STANDALONE_SECTION_LINE_PATTERN =
  /^(?![#>\-*\d`])([A-Z][A-Za-z0-9/&(),:'" -]{2,100})\s*:?\s*$/gmu;

export interface MarkdownSectionValidationResult {
  headings: string[];
  missingSections: string[];
}

export function extractMarkdownSectionHeadings(markdown: string): string[] {
  const headings: string[] = [];
  const seen = new Set<string>();

  for (const match of markdown.matchAll(MARKDOWN_HEADING_PATTERN)) {
    const heading = match[1]?.trim();
    if (heading && !seen.has(heading)) {
      seen.add(heading);
      headings.push(heading);
    }
  }

  for (const match of markdown.matchAll(STANDALONE_SECTION_LINE_PATTERN)) {
    const heading = match[1]?.trim();
    if (!heading || seen.has(heading) || heading.endsWith('.')) {
      continue;
    }

    seen.add(heading);
    headings.push(heading);
  }

  return headings;
}

export function validateRequiredMarkdownSections(
  markdown: string,
  requiredSections: readonly string[],
): MarkdownSectionValidationResult {
  const headings = extractMarkdownSectionHeadings(markdown);
  const missingSections = requiredSections.filter(
    (sectionName) =>
      !headings.some((heading) =>
        matchesRequiredSection(sectionName, heading),
      ),
  );

  return {
    headings,
    missingSections,
  };
}

export function createRequiredMarkdownSectionsSchema(
  requiredSections: readonly string[],
): z.ZodString {
  return z
    .string()
    .min(1)
    .superRefine((markdown, context) => {
      const result = validateRequiredMarkdownSections(
        markdown,
        requiredSections,
      );

      if (result.missingSections.length > 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Missing required markdown sections: ${result.missingSections.join(
            ', ',
          )}.`,
        });
      }
    });
}

function normalizeSectionName(sectionName: string): string {
  return sectionName
    .trim()
    .toLowerCase()
    .replace(/\s+/gu, ' ')
    .replace(/\s*\([^)]*\)\s*$/u, '')
    .replace(/\s*[-:]\s.*$/u, '')
    .trim();
}

function matchesRequiredSection(
  requiredSection: string,
  actualHeading: string,
): boolean {
  const normalizedRequired = normalizeSectionName(requiredSection);
  const normalizedActual = normalizeSectionName(actualHeading);

  return (
    normalizedActual === normalizedRequired ||
    normalizedActual.startsWith(`${normalizedRequired} `)
  );
}
