import { z } from 'zod';

import {
  JUDGE_TASK_TARGET_AGENTS,
  JUDGE_TASK_TYPES,
  type JudgeTaskTargetAgent,
} from './enums.js';

export const JudgeTaskPayloadSchema = z.object({
  taskType: z.enum(JUDGE_TASK_TYPES),
  targetAgent: z.enum(JUDGE_TASK_TARGET_AGENTS),
  description: z.string().min(1),
  blocking: z.boolean(),
});

export type JudgeTaskPayload = z.infer<typeof JudgeTaskPayloadSchema>;
export type JudgeTaskDto = JudgeTaskPayload;

export const JudgeTaskPromptInputSchema = z.object({
  task_type: z.enum(JUDGE_TASK_TYPES),
  target_agent: z.enum(JUDGE_TASK_TARGET_AGENTS),
  description: z.string().min(1),
  blocking: z.boolean(),
});

export type JudgeTaskPromptInput = z.infer<typeof JudgeTaskPromptInputSchema>;

export const JudgeTaskSchema = JudgeTaskPayloadSchema.extend({
  taskId: z.string().min(1),
  caseId: z.string().min(1),
  iterationId: z.string().min(1),
  iterationNo: z.number().int().positive(),
});

export type JudgeTask = z.infer<typeof JudgeTaskSchema>;

export function toJudgeTaskPromptInput(
  task: JudgeTaskPayload,
): JudgeTaskPromptInput {
  return {
    task_type: task.taskType,
    target_agent: task.targetAgent,
    description: task.description,
    blocking: task.blocking,
  };
}

export function fromJudgeTaskPromptInput(
  task: JudgeTaskPromptInput,
): JudgeTaskPayload {
  return {
    taskType: task.task_type,
    targetAgent: task.target_agent,
    description: task.description,
    blocking: task.blocking,
  };
}

export function filterJudgeTasksForTargetAgent(
  tasks: readonly JudgeTaskPayload[],
  targetAgent: JudgeTaskTargetAgent,
): JudgeTaskPayload[] {
  return tasks.filter((task) => task.targetAgent === targetAgent);
}
