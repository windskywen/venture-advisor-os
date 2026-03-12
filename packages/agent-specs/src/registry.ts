import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import type { ZodString } from 'zod';

import { createRequiredMarkdownSectionsSchema } from './markdown-sections.js';

export interface CommonPromptSpec {
  version: string;
  global_rules: string[];
  output_conventions: Record<string, unknown>;
  decision_labels: string[];
  scoring_scale: {
    min: number;
    max: number;
  };
}

export interface AgentPromptSpecDocument {
  agent_name: string;
  role: string;
  mission: string;
  objectives: string[];
  rules: string[];
  required_sections: string[];
  json_summary_schema: Record<string, unknown>;
  input_schema?: Record<string, unknown>;
  success_criteria: string[];
  [key: string]: unknown;
}

export interface PromptTemplateMetadata {
  agentName: string;
  version: string;
  fileName: string;
  filePath: string;
  versionSourceFileName: string;
  versionSourceFilePath: string;
  sourceText: string;
  role: string;
  mission: string;
  objectives: string[];
  rules: string[];
  requiredSections: string[];
  requiredMarkdownSectionsSchema: ZodString;
  successCriteria: string[];
  inputSchema?: Record<string, unknown>;
  jsonSummarySchema: Record<string, unknown>;
  common: CommonPromptSpec;
  spec: AgentPromptSpecDocument;
}

export interface PromptTemplateRegistry {
  version: string;
  common: CommonPromptSpec;
  commonFileName: string;
  commonFilePath: string;
  commonSourceText: string;
  agents: Record<string, PromptTemplateMetadata>;
  files: string[];
}

export interface PromptTemplateRegistryOptions {
  repoRoot?: string;
  specsDirectory?: string;
}

export function loadPromptTemplateRegistry(
  options: PromptTemplateRegistryOptions = {},
): PromptTemplateRegistry {
  const commonFileName = 'common.base.yaml';
  const specsDirectory =
    options.specsDirectory ??
    resolve(options.repoRoot ?? process.cwd(), 'docs', 'agent-specs');
  const files = readdirSync(specsDirectory)
    .filter((fileName) => fileName.endsWith('.yaml'))
    .sort();
  const commonFilePath = resolve(specsDirectory, commonFileName);
  const commonSourceText = readFileSync(commonFilePath, 'utf8');
  const common = parse(commonSourceText) as CommonPromptSpec;
  const agents: Record<string, PromptTemplateMetadata> = {};

  for (const fileName of files) {
    if (fileName === commonFileName) {
      continue;
    }

    const filePath = resolve(specsDirectory, fileName);
    const sourceText = readFileSync(filePath, 'utf8');
    const spec = parse(sourceText) as AgentPromptSpecDocument;

    if (!spec.agent_name) {
      throw new Error(`Prompt spec ${fileName} is missing agent_name.`);
    }

    agents[spec.agent_name] = {
      agentName: spec.agent_name,
      version: common.version,
      fileName,
      filePath,
      versionSourceFileName: commonFileName,
      versionSourceFilePath: commonFilePath,
      sourceText,
      role: spec.role,
      mission: spec.mission,
      objectives: spec.objectives,
      rules: spec.rules,
      requiredSections: spec.required_sections,
      requiredMarkdownSectionsSchema: createRequiredMarkdownSectionsSchema(
        spec.required_sections,
      ),
      successCriteria: spec.success_criteria,
      inputSchema: spec.input_schema,
      jsonSummarySchema: spec.json_summary_schema,
      common,
      spec,
    };
  }

  return {
    version: common.version,
    common,
    commonFileName,
    commonFilePath,
    commonSourceText,
    agents,
    files,
  };
}
