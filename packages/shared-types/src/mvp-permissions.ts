import type { PermissionLevel } from './enums.js';

export const MVP_ENABLED_PERMISSION_LEVELS = ['L0', 'L1'] as const satisfies readonly PermissionLevel[];

export const DISABLED_MVP_TELEGRAM_COMMANDS = [
  '/exec',
  '/shell',
  '/cmd',
  '/commit',
  '/push',
  '/deploy',
] as const;

export const MVP_PERMISSION_ERROR_MESSAGE =
  'MVP permissions are limited to L0 and L1. Local command, git, and deploy actions are disabled.';

export function isMvpPermissionLevelEnabled(
  permissionLevel: PermissionLevel,
): boolean {
  return MVP_ENABLED_PERMISSION_LEVELS.includes(
    permissionLevel as (typeof MVP_ENABLED_PERMISSION_LEVELS)[number],
  );
}

export function isMvpTelegramCommandDisabled(command: string): boolean {
  return DISABLED_MVP_TELEGRAM_COMMANDS.includes(
    command as (typeof DISABLED_MVP_TELEGRAM_COMMANDS)[number],
  );
}
