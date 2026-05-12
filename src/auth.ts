export type DemoRole = 'admin' | 'researcher' | 'viewer';

export interface DemoUser {
  username: string;
  password: string;
  role: DemoRole;
  displayName: string;
}

export interface AuthSession {
  username: string;
  role: DemoRole;
  displayName: string;
  issuedAt: string;
}

const SESSION_KEY = 'treeDashboard.demoAuthSession';

export const DEMO_USERS: DemoUser[] = [
  { username: 'admin', password: 'admin123', role: 'admin', displayName: 'Admin Demo' },
  { username: 'researcher', password: 'research123', role: 'researcher', displayName: 'Researcher Demo' },
  { username: 'viewer', password: 'viewer123', role: 'viewer', displayName: 'Viewer Demo' },
];

export function authenticateDemoUser(username: string, password: string): AuthSession | undefined {
  const normalized = username.trim().toLowerCase();
  const user = DEMO_USERS.find((candidate) => candidate.username === normalized && candidate.password === password);
  if (!user) return undefined;
  return {
    username: user.username,
    role: user.role,
    displayName: user.displayName,
    issuedAt: new Date().toISOString(),
  };
}

export function saveSession(session: AuthSession): void {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function loadSession(): AuthSession | undefined {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return undefined;

  try {
    const parsed = JSON.parse(raw) as Partial<AuthSession>;
    if (
      typeof parsed.username === 'string' &&
      typeof parsed.displayName === 'string' &&
      typeof parsed.issuedAt === 'string' &&
      (parsed.role === 'admin' || parsed.role === 'researcher' || parsed.role === 'viewer')
    ) {
      return parsed as AuthSession;
    }
  } catch {
    // Invalid stored sessions are treated as signed out.
  }
  clearSession();
  return undefined;
}

export function clearSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
}

export function canUseAnalysis(role: DemoRole): boolean {
  return role === 'admin' || role === 'researcher';
}

export function canManageUsers(role: DemoRole): boolean {
  return role === 'admin';
}
