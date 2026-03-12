import { describe, expect, it } from 'vitest';

import {
  isMvpPermissionLevelEnabled,
  isMvpTelegramCommandDisabled,
  MVP_PERMISSION_ERROR_MESSAGE,
} from '../src/index.js';

describe('MVP permission policy', () => {
  it('enables only L0 and L1 in MVP', () => {
    expect(isMvpPermissionLevelEnabled('L0')).toBe(true);
    expect(isMvpPermissionLevelEnabled('L1')).toBe(true);
    expect(isMvpPermissionLevelEnabled('L2')).toBe(false);
    expect(isMvpPermissionLevelEnabled('L3')).toBe(false);
    expect(isMvpPermissionLevelEnabled('L4')).toBe(false);
  });

  it('flags shell, git, and deploy-style Telegram commands as disabled', () => {
    expect(isMvpTelegramCommandDisabled('/deploy')).toBe(true);
    expect(isMvpTelegramCommandDisabled('/commit')).toBe(true);
    expect(isMvpTelegramCommandDisabled('/push')).toBe(true);
    expect(isMvpTelegramCommandDisabled('/newidea')).toBe(false);
    expect(MVP_PERMISSION_ERROR_MESSAGE).toContain('L0 and L1');
  });
});
