import { beforeEach, describe, expect, it } from 'vitest';
import {
  authenticateDemoUser,
  canManageUsers,
  canUseAnalysis,
  clearSession,
  loadSession,
  saveSession,
} from '../auth';

describe('demo auth', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('accepts known demo users and rejects invalid credentials', () => {
    expect(authenticateDemoUser('researcher', 'research123')?.role).toBe('researcher');
    expect(authenticateDemoUser('viewer', 'bad')).toBeUndefined();
  });

  it('persists and clears a session', () => {
    const session = authenticateDemoUser('admin', 'admin123');
    expect(session).toBeDefined();
    saveSession(session!);
    expect(loadSession()?.username).toBe('admin');
    clearSession();
    expect(loadSession()).toBeUndefined();
  });

  it('enforces demo role checks', () => {
    expect(canUseAnalysis('viewer')).toBe(false);
    expect(canUseAnalysis('researcher')).toBe(true);
    expect(canManageUsers('researcher')).toBe(false);
    expect(canManageUsers('admin')).toBe(true);
  });
});
