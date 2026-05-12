import { initMap2D } from './map2d';
import { initViewer3D } from './viewer3d';
import { addRasterLayerPanel } from './rasterLayers';

function main() {
  const mapEl           = document.getElementById('map') as HTMLElement;
  const statsEl         = document.getElementById('stats-panel') as HTMLElement;
  const potreeContainer = document.getElementById('potree-container') as HTMLElement;
  const btn3d           = document.getElementById('btn-3d') as HTMLButtonElement;
  const btn2d           = document.getElementById('btn-2d') as HTMLButtonElement;
  const layerPanel      = document.getElementById('layer-panel') as HTMLElement | null;
  const rasterPanel     = document.getElementById('raster-panel') as HTMLElement | null;

  const map    = initMap2D(mapEl, statsEl);
  const viewer = initViewer3D(potreeContainer);

  if (rasterPanel) {
    addRasterLayerPanel(map, rasterPanel);
  }

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

main();
