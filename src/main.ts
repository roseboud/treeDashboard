import 'ol/ol.css';
import { initMap2D } from './map2d';
import { initViewer3D } from './viewer3d';
import { addRasterLayerPanel } from './rasterLayers';

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

function main() {
  const mapEl           = document.getElementById('map') as HTMLElement;
  const statsEl         = document.getElementById('stats-panel') as HTMLElement;
  const potreeContainer = document.getElementById('potree-container') as HTMLElement;
  const btn3d           = document.getElementById('btn-3d') as HTMLButtonElement;
  const btn2d           = document.getElementById('btn-2d') as HTMLButtonElement;
  const layerPanel      = document.getElementById('layer-panel') as HTMLElement | null;
  const rasterPanel     = document.getElementById('raster-panel') as HTMLElement | null;

  statsEl.textContent = 'Initializing dashboard…';

  const map    = initMap2D(mapEl, statsEl);
  const viewer = initViewer3D(potreeContainer);

  if (rasterPanel) {
    addRasterLayerPanel(map, rasterPanel);
  }

  requestAnimationFrame(() => map.updateSize());
  window.setTimeout(() => map.updateSize(), 250);

  btn3d.addEventListener('click', () => {
    // Hide 2D map and its panels
    mapEl.style.display = 'none';
    if (layerPanel)  layerPanel.style.visibility  = 'hidden';
    if (rasterPanel) rasterPanel.style.visibility = 'hidden';

    // Release OL WebGL context so Potree / our WebGL canvas can use it
    map.setTarget(undefined);

    // Show 3D container and toggle buttons
    btn3d.style.display = 'none';
    btn2d.style.display = 'inline-block';

    viewer.load();
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

    btn3d.style.display = 'inline-block';
  });
}

window.addEventListener('error', (event) => showFatalError(event.error ?? event.message));
window.addEventListener('unhandledrejection', (event) => showFatalError(event.reason));

try {
  main();
} catch (error) {
  showFatalError(error);
}
