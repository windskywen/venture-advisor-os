export function extractJsonSummary(rawOutput: string | unknown): unknown {
  if (typeof rawOutput !== 'string') {
    return rawOutput;
  }

  const jsonFenceMatch = rawOutput.match(/```json\s*([\s\S]*?)\s*```/iu);
  if (jsonFenceMatch?.[1]) {
    return JSON.parse(jsonFenceMatch[1]);
  }

  const trimmed = rawOutput.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return JSON.parse(trimmed);
  }

  const firstBraceIndex = rawOutput.indexOf('{');
  const lastBraceIndex = rawOutput.lastIndexOf('}');
  if (firstBraceIndex !== -1 && lastBraceIndex > firstBraceIndex) {
    return JSON.parse(rawOutput.slice(firstBraceIndex, lastBraceIndex + 1));
  }

  throw new Error('No JSON summary found in raw output.');
}
