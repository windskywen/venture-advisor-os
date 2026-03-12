import { z } from 'zod';

const MARKDOWN_HEADING_PATTERN = /^#{1,6}\s+(.+?)\s*$/gmu;

export interface MarkdownSectionValidationResult {
  headings: string[];
  missingSections: string[];
}

export function extractMarkdownSectionHeadings(markdown: string): string[] {
  const headings: string[] = [];

  for (const match of markdown.matchAll(MARKDOWN_HEADING_PATTERN)) {
    const heading = match[1]?.trim();
    if (heading) {
      headings.push(heading);
    }
  }

  return headings;
}

export function validateRequiredMarkdownSections(
  markdown: string,
  requiredSections: readonly string[],
): MarkdownSectionValidationResult {
  const headings = extractMarkdownSectionHeadings(markdown);
  const normalizedHeadings = new Set(headings.map(normalizeSectionName));
  const missingSections = requiredSections.filter(
    (sectionName) => !normalizedHeadings.has(normalizeSectionName(sectionName)),
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
  return sectionName.trim().toLowerCase();
}
