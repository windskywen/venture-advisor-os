import type { OverrideAction } from './enums.js';

export const HIGH_RISK_HUMAN_OVERRIDE_ACTIONS = [
  'FORCE_PASS_TO_PRD',
  'FORCE_REJECT',
] as const satisfies readonly OverrideAction[];

export type HighRiskHumanOverrideAction =
  (typeof HIGH_RISK_HUMAN_OVERRIDE_ACTIONS)[number];

export function isHighRiskHumanOverrideAction(
  action: OverrideAction,
): action is HighRiskHumanOverrideAction {
  return HIGH_RISK_HUMAN_OVERRIDE_ACTIONS.includes(
    action as HighRiskHumanOverrideAction,
  );
}

export function getHumanOverrideRiskLevel(
  action: OverrideAction,
): 'standard' | 'high' {
  return isHighRiskHumanOverrideAction(action) ? 'high' : 'standard';
}
