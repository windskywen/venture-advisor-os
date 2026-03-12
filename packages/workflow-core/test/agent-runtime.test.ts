import { describe, expect, it, vi } from 'vitest';

import {
  createCodexRuntimeAdapter,
  createMockAgentRuntimeAdapter,
} from '../src/index.js';

describe('agent runtime adapter', () => {
  it('runs prompts through the mock adapter contract', async () => {
    const adapter = createMockAgentRuntimeAdapter((request) => ({
      agentName: request.agentName,
      rawOutput: `mocked:${request.inputPayload.topic}`,
      metadata: {
        backend: 'mock',
      },
    }));

    await expect(
      adapter.run({
        agentName: 'FactResearcher',
        prompt: 'Prompt body',
        inputPayload: {
          topic: 'AI note-taking',
        },
      }),
    ).resolves.toEqual({
      agentName: 'FactResearcher',
      rawOutput: 'mocked:AI note-taking',
      metadata: {
        backend: 'mock',
      },
    });
  });

  it('delegates runtime execution to the Codex/Copilot transport behind the same contract', async () => {
    const send = vi.fn(async () => ({
      agentName: 'Judge' as const,
      rawOutput: '{"decision":"PASS"}',
      metadata: {
        backend: 'codex',
        latencyMs: 250,
      },
    }));
    const adapter = createCodexRuntimeAdapter({ send });

    await expect(
      adapter.run({
        agentName: 'Judge',
        prompt: 'Prompt body',
        inputPayload: {
          topic: 'AI note-taking',
        },
      }),
    ).resolves.toEqual({
      agentName: 'Judge',
      rawOutput: '{"decision":"PASS"}',
      metadata: {
        backend: 'codex',
        latencyMs: 250,
      },
    });

    expect(send).toHaveBeenCalledTimes(1);
  });
});
