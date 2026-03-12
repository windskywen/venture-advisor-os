import type {
  AgentRuntimeAdapter,
  AgentRuntimeRequest,
  AgentRuntimeResponse,
} from './agent-runtime.js';

const STRICT_FORMATTING_REMINDER =
  'STRICT FORMATTING REMINDER: Return only the required markdown sections and JSON summary in the exact schema shape. Do not add extra prose before or after the required sections. Preserve citation markers for factual claims.';

export interface MalformedOutputRetryInput<TNormalizedOutput> {
  runtime: AgentRuntimeAdapter;
  request: AgentRuntimeRequest;
  normalize: (rawOutput: string) => TNormalizedOutput;
}

export type MalformedOutputRetryResult<TNormalizedOutput> =
  | {
      success: true;
      response: AgentRuntimeResponse;
      normalizedOutput: TNormalizedOutput;
      attempts: number;
      validationErrors: string[];
    }
  | {
      success: false;
      failureCategory: 'MALFORMED_OUTPUT';
      response: AgentRuntimeResponse;
      attempts: number;
      validationErrors: string[];
    };

export async function executeWithMalformedOutputRetry<TNormalizedOutput>(
  input: MalformedOutputRetryInput<TNormalizedOutput>,
): Promise<MalformedOutputRetryResult<TNormalizedOutput>> {
  const validationErrors: string[] = [];
  let request = input.request;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const response = await input.runtime.run(request);

    try {
      const normalizedOutput = input.normalize(response.rawOutput);

      return {
        success: true,
        response,
        normalizedOutput,
        attempts: attempt,
        validationErrors,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      validationErrors.push(message);

      if (attempt === 2) {
        return {
          success: false,
          failureCategory: 'MALFORMED_OUTPUT',
          response,
          attempts: attempt,
          validationErrors,
        };
      }

      request = {
        ...request,
        prompt: `${request.prompt}\n\n${STRICT_FORMATTING_REMINDER}\nPrevious validation errors:\n- ${message}`,
      };
    }
  }

  throw new Error('Malformed output retry exhausted unexpectedly.');
}
