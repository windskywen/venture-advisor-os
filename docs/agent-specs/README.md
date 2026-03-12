# Agent Prompt Specs

The YAML files in this directory are the first-class source of truth for agent prompting rules. Runtime prompt rendering and persisted prompt template versions must trace back to these files instead of maintaining a second prompt definition elsewhere in the repo.

## Files

- `common.base.yaml`: shared prompt version, global rules, output conventions, decision labels, and scoring scale.
- `agent-a.fact-researcher.yaml`
- `agent-b.opportunity-strategist.yaml`
- `agent-c.vc-critic.yaml`
- `agent-d.prd-strategist.yaml`
- `agent-e.poc-architect.yaml`
- `agent-j.judge.yaml`

## Runtime Mapping

`packages/agent-specs/src/registry.ts` loads `docs/agent-specs/*.yaml` and exposes traceable metadata for each agent:

- `agentName`: taken from the agent YAML `agent_name`.
- `fileName` and `filePath`: the exact source YAML file for that agent.
- `version`: taken from `common.base.yaml` `version`.
- `versionSourceFileName` and `versionSourceFilePath`: the shared YAML file that supplied the version and common rules.
- `sourceText`: the raw YAML body loaded from disk.

## Persisted Prompt Template Version Mapping

Rows in `prompt_template_versions` map back to source YAML as follows:

- `agentName` -> agent YAML `agent_name`
- `version` -> `common.base.yaml` `version`
- `templateBody` -> raw YAML body from the agent file
- `schemaBody` -> the agent YAML `json_summary_schema`
- `state` -> deployment/runtime activation state, not a value stored inside the YAML
- `templateVersionId` -> the persisted identifier for that imported snapshot

Because the shared version comes from `common.base.yaml`, all agent templates loaded from the same registry snapshot share the same semantic prompt version while still keeping a one-to-one trace back to their own YAML file.

## Update Workflow

1. Edit the relevant file in `docs/agent-specs/`.
2. If the prompt contract changed, update the shared version in `common.base.yaml`.
3. Reload the prompt registry so the runtime metadata reflects the changed YAML.
4. Persist new `prompt_template_versions` rows from that registry snapshot and mark the intended version active.

Do not hand-edit prompt copies in TypeScript when the canonical change belongs in YAML.
