import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';

const specDirectory = resolve(process.cwd(), 'docs', 'agent-specs');
const expectedSpecs = new Map([
  ['agent-a.fact-researcher.yaml', 'FactResearcher'],
  ['agent-b.opportunity-strategist.yaml', 'OpportunityStrategist'],
  ['agent-c.vc-critic.yaml', 'VCCritic'],
  ['agent-d.prd-strategist.yaml', 'PRDStrategist'],
  ['agent-e.poc-architect.yaml', 'POCArchitect'],
  ['agent-j.judge.yaml', 'Judge'],
]);

const decisionLabels = readYaml('common.base.yaml').decision_labels ?? [];
const errors = [];

for (const [fileName, expectedAgentName] of expectedSpecs) {
  const spec = readYaml(fileName);
  validateSpecIdentity(fileName, spec, expectedAgentName);
  validatePromptArrays(fileName, spec);
}

validateJudgeSpec();
validateRerunTaskContracts();

if (errors.length > 0) {
  console.error('Prompt-spec validation failed:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`Validated ${expectedSpecs.size} prompt specs.`);

function readYaml(fileName) {
  return parse(readFileSync(resolve(specDirectory, fileName), 'utf8'));
}

function validateSpecIdentity(fileName, spec, expectedAgentName) {
  if (spec.agent_name !== expectedAgentName) {
    errors.push(`${fileName} must declare agent_name "${expectedAgentName}".`);
  }

  if (!hasText(spec.role)) {
    errors.push(`${fileName} must define a role.`);
  }

  if (!hasText(spec.mission)) {
    errors.push(`${fileName} must define a mission.`);
  }
}

function validatePromptArrays(fileName, spec) {
  validateStringArray(`${fileName} objectives`, spec.objectives);
  validateStringArray(`${fileName} rules`, spec.rules);
  validateStringArray(`${fileName} required_sections`, spec.required_sections);
  validateStringArray(`${fileName} success_criteria`, spec.success_criteria);

  ensureUnique(`${fileName} objectives`, spec.objectives);
  ensureUnique(`${fileName} rules`, spec.rules);
  ensureUnique(`${fileName} required_sections`, spec.required_sections);
  ensureUnique(`${fileName} success_criteria`, spec.success_criteria);
}

function validateJudgeSpec() {
  const judgeSpec = readYaml('agent-j.judge.yaml');
  const decisionEnum =
    judgeSpec?.json_summary_schema?.properties?.decision?.enum;
  const nextTaskSchema =
    judgeSpec?.json_summary_schema?.properties?.next_iteration_tasks?.items;

  if (decisionLabels.join('|') !== judgeSpec.allowed_decisions?.join('|')) {
    errors.push(
      'agent-j.judge.yaml allowed_decisions must match common.base.yaml decision_labels.',
    );
  }

  if (decisionLabels.join('|') !== decisionEnum?.join('|')) {
    errors.push(
      'agent-j.judge.yaml json_summary_schema.properties.decision.enum must match common.base.yaml decision_labels.',
    );
  }

  const requiredTaskFields = nextTaskSchema?.properties
    ? ['target_agent', 'task_type', 'description', 'blocking'].filter(
        (fieldName) => !(fieldName in nextTaskSchema.properties),
      )
    : ['target_agent', 'task_type', 'description', 'blocking'];

  if (requiredTaskFields.length > 0) {
    errors.push(
      `agent-j.judge.yaml next_iteration_tasks items are missing fields: ${requiredTaskFields.join(', ')}.`,
    );
  }
}

function validateRerunTaskContracts() {
  const expectedTaskFields = [
    'task_type',
    'target_agent',
    'description',
    'blocking',
  ];
  const expectedTargetAgents = ['FACT_RESEARCHER', 'OPPORTUNITY_STRATEGIST'];

  for (const [fileName, expectedTargetAgent] of [
    ['agent-a.fact-researcher.yaml', 'FACT_RESEARCHER'],
    ['agent-b.opportunity-strategist.yaml', 'OPPORTUNITY_STRATEGIST'],
  ]) {
    const spec = readYaml(fileName);
    const required =
      spec?.input_schema?.properties?.judge_tasks?.items?.required ?? [];
    const targetAgentEnum =
      spec?.input_schema?.properties?.judge_tasks?.items?.properties
        ?.target_agent?.enum ?? [];
    const taskRule = spec.rules?.find((rule) =>
      rule.includes(`Only tasks targeted at ${expectedTargetAgent}`),
    );

    if (required.join('|') !== expectedTaskFields.join('|')) {
      errors.push(
        `${fileName} judge_tasks.items.required must equal ${expectedTaskFields.join(', ')}.`,
      );
    }

    if (targetAgentEnum.join('|') !== expectedTargetAgents.join('|')) {
      errors.push(
        `${fileName} judge_tasks target_agent enum must match the shared JudgeTask contract.`,
      );
    }

    if (!hasText(taskRule)) {
      errors.push(
        `${fileName} must contain the target-agent execution rule for ${expectedTargetAgent}.`,
      );
    }
  }
}

function validateStringArray(label, value) {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some((item) => !hasText(item))
  ) {
    errors.push(`${label} must be a non-empty string array.`);
  }
}

function ensureUnique(label, value) {
  if (!Array.isArray(value)) {
    return;
  }

  if (new Set(value).size !== value.length) {
    errors.push(`${label} must not contain duplicates.`);
  }
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}
