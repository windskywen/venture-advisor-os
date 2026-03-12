import type { AgentName, AgentOutput } from '@venture-advisor-os/shared-types';

export interface TraceablePriorOutputRef {
  agentOutputId: string;
  agentName: AgentName;
  iterationId: string;
  iterationNo: number;
  createdAt: string;
  normalizedOutput: Record<string, unknown>;
}

export interface TraceablePriorOutputs {
  latestByAgent: Partial<Record<AgentName, TraceablePriorOutputRef>>;
  history: TraceablePriorOutputRef[];
}

export function buildTraceablePriorOutputs(
  agentOutputs: readonly AgentOutput[],
): { traceable_prior_outputs: TraceablePriorOutputs } {
  const history = [...agentOutputs]
    .map((agentOutput) => ({
      agentOutputId: agentOutput.agentOutputId,
      agentName: agentOutput.agentName,
      iterationId: agentOutput.iterationId,
      iterationNo: agentOutput.iterationNo,
      createdAt: agentOutput.createdAt,
      normalizedOutput: agentOutput.normalizedOutput,
    }))
    .sort(compareTraceablePriorOutputRefs);

  const latestByAgent = history.reduce<
    Partial<Record<AgentName, TraceablePriorOutputRef>>
  >((acc, output) => {
    acc[output.agentName] ??= output;
    return acc;
  }, {});

  return {
    traceable_prior_outputs: {
      latestByAgent,
      history,
    },
  };
}

function compareTraceablePriorOutputRefs(
  left: TraceablePriorOutputRef,
  right: TraceablePriorOutputRef,
): number {
  if (left.iterationNo !== right.iterationNo) {
    return right.iterationNo - left.iterationNo;
  }

  if (left.createdAt !== right.createdAt) {
    return right.createdAt.localeCompare(left.createdAt);
  }

  return left.agentName.localeCompare(right.agentName);
}
