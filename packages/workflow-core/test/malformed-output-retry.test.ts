import { describe, expect, it } from 'vitest';

import {
  createMockAgentRuntimeAdapter,
  executeWithMalformedOutputRetry,
} from '../src/index.js';

describe('malformed output retry', () => {
  it('retries malformed output once with a stricter formatting reminder', async () => {
    const prompts: string[] = [];
    let callCount = 0;
    const runtime = createMockAgentRuntimeAdapter((request) => {
      prompts.push(request.prompt);
      callCount += 1;

      return {
        agentName: 'FactResearcher',
        rawOutput:
          callCount === 1
            ? 'not json'
            : '{"market_problem_definition":"ok","target_user_segments":[],"pain_points":[],"workflow_gaps":[],"current_alternatives":[],"competitors":[],"evidence":[],"assumptions":[]}',
      };
    });

    const result = await executeWithMalformedOutputRetry({
      runtime,
      request: {
        agentName: 'FactResearcher',
        prompt: 'Original prompt',
        inputPayload: {},
      },
      normalize(rawOutput) {
        return JSON.parse(rawOutput) as Record<string, unknown>;
      },
    });

    expect(result.success).toBe(true);
    expect(result.attempts).toBe(2);
    expect(prompts[1]).toContain('STRICT FORMATTING REMINDER');
  });

  it('fails safely after the retry is exhausted', async () => {
    const runtime = createMockAgentRuntimeAdapter(() => ({
      agentName: 'Judge',
      rawOutput: 'still not json',
    }));

    const result = await executeWithMalformedOutputRetry({
      runtime,
      request: {
        agentName: 'Judge',
        prompt: 'Original prompt',
        inputPayload: {},
      },
      normalize(rawOutput) {
        return JSON.parse(rawOutput) as Record<string, unknown>;
      },
    });

    expect(result).toMatchObject({
      success: false,
      failureCategory: 'MALFORMED_OUTPUT',
      attempts: 2,
    });
  });
});
