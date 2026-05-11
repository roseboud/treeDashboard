import { initMap2D } from './map2d';
import { initViewer3D } from './viewer3d';
import { addRasterLayerPanel } from './rasterLayers';

function main() {
  const mapEl = document.getElementById('map') as HTMLElement;
  const statsEl = document.getElementById('stats-panel') as HTMLElement;
  const potreeContainer = document.getElementById('potree-container') as HTMLElement;
  const btn3d = document.getElementById('btn-3d') as HTMLButtonElement;
  const btn2d = document.getElementById('btn-2d') as HTMLButtonElement;
  const rasterPanel = document.getElementById('raster-panel') as HTMLElement | null;

  const map = initMap2D(mapEl, statsEl);
  const viewer = initViewer3D(potreeContainer);

  if (rasterPanel) {
    addRasterLayerPanel(map, rasterPanel);
  }

  btn3d.addEventListener('click', () => {
    mapEl.style.display = 'none';
    btn3d.style.display = 'none';
    potreeContainer.style.display = 'block';
    btn2d.style.display = 'inline-block';
    viewer.load();
  });

  btn2d.addEventListener('click', () => {
    potreeContainer.style.display = 'none';
    btn2d.style.display = 'none';
    mapEl.style.display = 'block';
    btn3d.style.display = 'inline-block';
  });
}

main();
