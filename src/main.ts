import 'ol/ol.css';
import { initMap2D } from './map2d';
import { initViewer3D } from './viewer3d';
import { addRasterLayerPanel } from './rasterLayers';
import {
  authenticateDemoUser,
  canManageUsers,
  canUseAnalysis,
  clearSession,
  loadSession,
  saveSession,
  type AuthSession,
} from './auth';

function showFatalError(error: unknown): void {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  console.error('Dashboard startup/runtime error', error);

  let panel = document.getElementById('runtime-error-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'runtime-error-panel';
    document.body.appendChild(panel);
  }
  panel.innerHTML = `
    <strong>Dashboard error</strong>
    <span>${message}</span>
    <small>Open DevTools Console for details. If this is a fresh clone, run <code>npm install</code> and restart Vite with <code>--force</code>.</small>
  `;
}

function requireElement<T extends HTMLElement>(id: string, type: { new(): T }): T {
  const element = document.getElementById(id);
  if (!(element instanceof type)) {
    throw new Error(`Missing required dashboard element: #${id}`);
  }
  return element;
}

function configureAuthUi(session: AuthSession): void {
  const loginScreen = requireElement('login-screen', HTMLElement);
  const userBadge = requireElement('user-badge', HTMLElement);
  const logoutButton = requireElement('btn-logout', HTMLButtonElement);
  const validationPanel = document.getElementById('validation-panel') as HTMLElement | null;
  const filterPanel = document.getElementById('filter-panel') as HTMLElement | null;
  const adminPanel = document.getElementById('admin-panel') as HTMLElement | null;

  loginScreen.style.display = 'none';
  userBadge.textContent = `${session.displayName} (${session.role})`;
  logoutButton.addEventListener('click', () => {
    clearSession();
    window.location.reload();
  });

  if (!canUseAnalysis(session.role)) {
    if (validationPanel) validationPanel.style.display = 'none';
    if (filterPanel) filterPanel.style.display = 'none';
  }

  if (adminPanel) {
    adminPanel.style.display = canManageUsers(session.role) ? 'block' : 'none';
  }
}

function showLogin(onAuthenticated: (session: AuthSession) => void): void {
  const loginScreen = requireElement('login-screen', HTMLElement);
  const loginForm = requireElement('login-form', HTMLFormElement);
  const usernameInput = requireElement('login-username', HTMLInputElement);
  const passwordInput = requireElement('login-password', HTMLInputElement);
  const errorEl = requireElement('login-error', HTMLElement);

  loginScreen.style.display = 'flex';
  loginForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const session = authenticateDemoUser(usernameInput.value, passwordInput.value);
    if (!session) {
      errorEl.textContent = 'Invalid demo username or password.';
      return;
    }
    saveSession(session);
    onAuthenticated(session);
  });
}

function main(session: AuthSession) {
  const mapEl           = requireElement('map', HTMLElement);
  const statsEl         = requireElement('stats-panel', HTMLElement);
  const potreeContainer = requireElement('potree-container', HTMLElement);
  const btn3d           = requireElement('btn-3d', HTMLButtonElement);
  const btn2d           = requireElement('btn-2d', HTMLButtonElement);
  const layerPanel      = document.getElementById('layer-panel') as HTMLElement | null;
  const rasterPanel     = document.getElementById('raster-panel') as HTMLElement | null;
  const filterPanel     = document.getElementById('filter-panel') as HTMLElement | null;
  const validationPanel = document.getElementById('validation-panel') as HTMLElement | null;

  configureAuthUi(session);
  statsEl.textContent = 'Initializing dashboard…';

  const map    = initMap2D(mapEl, statsEl);
  const viewer = initViewer3D(potreeContainer);

  let disposeRasterPanel: (() => void) | undefined;
  if (rasterPanel) {
    disposeRasterPanel = addRasterLayerPanel(map, rasterPanel);
  }

  requestAnimationFrame(() => map.updateSize());
  window.setTimeout(() => map.updateSize(), 250);

  btn3d.addEventListener('click', () => {
    // Hide 2D map and its panels
    mapEl.style.display = 'none';
    if (layerPanel)  layerPanel.style.visibility  = 'hidden';
    if (rasterPanel) rasterPanel.style.visibility = 'hidden';
    if (filterPanel) filterPanel.style.visibility = 'hidden';
    if (validationPanel) validationPanel.style.visibility = 'hidden';

    // Release OL WebGL context so Potree / our WebGL canvas can use it
    map.setTarget(undefined);

    // Show 3D container and toggle buttons
    btn3d.style.display = 'none';
    btn2d.style.display = 'inline-block';

    viewer.load();
    requestAnimationFrame(() => viewer.resize());
  });

  btn2d.addEventListener('click', () => {
    // Hide 3D container
    potreeContainer.style.display = 'none';
    btn2d.style.display = 'none';

    // Restore 2D map and its panels
    mapEl.style.display = 'block';
    map.setTarget(mapEl);           // re-attach OL WebGL context
    map.updateSize();               // force OL to recalculate viewport size
    if (layerPanel)  layerPanel.style.visibility  = 'visible';
    if (rasterPanel) rasterPanel.style.visibility = 'visible';
    if (filterPanel) filterPanel.style.visibility = 'visible';
    if (validationPanel) validationPanel.style.visibility = 'visible';

    btn3d.style.display = 'inline-block';
  });

  window.addEventListener('beforeunload', () => {
    disposeRasterPanel?.();
    viewer.destroy();
  });
}

window.addEventListener('error', (event) => showFatalError(event.error ?? event.message));
window.addEventListener('unhandledrejection', (event) => showFatalError(event.reason));

try {
  const session = loadSession();
  if (session) {
    main(session);
  } else {
    showLogin((authenticated) => main(authenticated));
  }
} catch (error) {
  showFatalError(error);
}
