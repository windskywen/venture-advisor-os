import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';

const specDirectory = resolve(process.cwd(), 'docs', 'agent-specs');
const specFiles = readdirSync(specDirectory)
  .filter((fileName) => fileName.endsWith('.yaml'))
  .sort();

const errors = [];
const commonSpec = readYaml('common.base.yaml');
const agentNames = new Set();

validateCommonSpec(commonSpec);

for (const fileName of specFiles) {
  if (fileName === 'common.base.yaml') {
    continue;
  }

  const spec = readYaml(fileName);
  validateAgentSpec(fileName, spec);
}

if (errors.length > 0) {
  console.error('Agent schema validation failed:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(
  `Validated ${specFiles.length - 1} agent schemas and common.base.yaml.`,
);

function readYaml(fileName) {
  const filePath = resolve(specDirectory, fileName);
  const content = readFileSync(filePath, 'utf8');
  return parse(content);
}

function validateCommonSpec(spec) {
  if (!isRecord(spec)) {
    errors.push('common.base.yaml must parse to an object.');
    return;
  }

  ensureNonEmptyString('common.base.yaml version', spec.version);
  ensureStringArray('common.base.yaml global_rules', spec.global_rules);

  if (!isRecord(spec.output_conventions)) {
    errors.push('common.base.yaml output_conventions must be an object.');
  } else {
    ensureBooleanTrue(
      'common.base.yaml output_conventions.markdown_sections',
      spec.output_conventions.markdown_sections,
    );
    ensureBooleanTrue(
      'common.base.yaml output_conventions.json_summary_required',
      spec.output_conventions.json_summary_required,
    );
    ensureBooleanTrue(
      'common.base.yaml output_conventions.citation_required_for_facts',
      spec.output_conventions.citation_required_for_facts,
    );
  }

  ensureExactArray('common.base.yaml decision_labels', spec.decision_labels, [
    'PASS',
    'REVISE',
    'PIVOT',
    'REJECT',
  ]);

  if (!isRecord(spec.scoring_scale)) {
    errors.push('common.base.yaml scoring_scale must be an object.');
    return;
  }

  if (spec.scoring_scale.min !== 1 || spec.scoring_scale.max !== 10) {
    errors.push('common.base.yaml scoring_scale must be 1..10.');
  }
}

function validateAgentSpec(fileName, spec) {
  if (!isRecord(spec)) {
    errors.push(`${fileName} must parse to an object.`);
    return;
  }

  ensureNonEmptyString(`${fileName} agent_name`, spec.agent_name);
  ensureNonEmptyString(`${fileName} role`, spec.role);
  ensureNonEmptyString(`${fileName} mission`, spec.mission);
  ensureStringArray(`${fileName} objectives`, spec.objectives);
  ensureStringArray(`${fileName} rules`, spec.rules);
  ensureStringArray(`${fileName} required_sections`, spec.required_sections);
  ensureUniqueStringArray(
    `${fileName} required_sections`,
    spec.required_sections,
  );
  ensureStringArray(`${fileName} success_criteria`, spec.success_criteria);

  if (typeof spec.agent_name === 'string') {
    if (agentNames.has(spec.agent_name)) {
      errors.push(`${fileName} duplicates agent_name "${spec.agent_name}".`);
    }
    agentNames.add(spec.agent_name);
  }

  validateSchemaNode(`${fileName} input_schema`, spec.input_schema);
  validateSchemaNode(
    `${fileName} json_summary_schema`,
    spec.json_summary_schema,
  );

  if (
    isRecord(spec.json_summary_schema) &&
    Array.isArray(spec.json_summary_schema.required)
  ) {
    const properties = isRecord(spec.json_summary_schema.properties)
      ? spec.json_summary_schema.properties
      : {};
    for (const requiredKey of spec.json_summary_schema.required) {
      if (!(requiredKey in properties)) {
        errors.push(
          `${fileName} json_summary_schema.required references missing property "${requiredKey}".`,
        );
      }
    }
  }

  if ('allowed_decisions' in spec) {
    ensureExactArray(
      `${fileName} allowed_decisions`,
      spec.allowed_decisions,
      commonSpec.decision_labels,
    );
  }
}

function validateSchemaNode(label, node) {
  if (!isRecord(node)) {
    errors.push(`${label} must be an object.`);
    return;
  }

  if (typeof node.type !== 'string' || node.type.length === 0) {
    errors.push(`${label} must define a string type.`);
  }

  if ('required' in node && !Array.isArray(node.required)) {
    errors.push(`${label} required must be an array.`);
  }

  if ('enum' in node && !Array.isArray(node.enum)) {
    errors.push(`${label} enum must be an array when present.`);
  }

  if ('properties' in node) {
    if (node.type !== 'object') {
      errors.push(
        `${label} must declare type "object" when properties are present.`,
      );
    }
    if (!isRecord(node.properties)) {
      errors.push(`${label} properties must be an object.`);
    } else {
      for (const [propertyName, propertySchema] of Object.entries(
        node.properties,
      )) {
        validateSchemaNode(`${label}.${propertyName}`, propertySchema);
      }
    }
  }

  if ('items' in node) {
    if (node.type !== 'array') {
      errors.push(`${label} must declare type "array" when items are present.`);
    }
    validateSchemaNode(`${label}.items`, node.items);
  }
}

function ensureBooleanTrue(label, value) {
  if (value !== true) {
    errors.push(`${label} must be true.`);
  }
}

function ensureNonEmptyString(label, value) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    errors.push(`${label} must be a non-empty string.`);
  }
}

function ensureStringArray(label, value) {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.some((item) => !isNonEmptyString(item))
  ) {
    errors.push(`${label} must be a non-empty string array.`);
  }
}

function ensureUniqueStringArray(label, value) {
  if (!Array.isArray(value)) {
    return;
  }

  if (new Set(value).size !== value.length) {
    errors.push(`${label} must not contain duplicates.`);
  }
}

function ensureExactArray(label, value, expected) {
  if (!Array.isArray(value)) {
    errors.push(`${label} must be an array.`);
    return;
  }

  if (value.join('|') !== expected.join('|')) {
    errors.push(`${label} must equal [${expected.join(', ')}].`);
  }
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
