import type { Box3, PerspectiveCamera, Scene, WebGLRenderer } from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { PointCloudOctree, Potree } from 'potree-loader';

interface PotreeDataset {
  id: string;
  label: string;
  baseUrl: string;
  points: number;
}

interface ViewerState {
  scene: Scene;
  camera: PerspectiveCamera;
  renderer: WebGLRenderer;
  controls: OrbitControls;
  potree: Potree;
  pointClouds: PointCloudOctree[];
  datasets: PotreeDataset[];
  overlayEl: HTMLElement;
  animationFrame: number | null;
  resizeObserver?: ResizeObserver;
  resizeHandler?: () => void;
  initialized: boolean;
}

export interface Viewer3D {
  load(): void;
  resize(): void;
  destroy(): void;
}

const POINT_BUDGET = 2_000_000;

export const POTREE_DATASETS: PotreeDataset[] = [
  {
    id: 'section-1',
    label: 'Section 1',
    baseUrl: '/Potree/20250919_Hutchinson_Section1_L2_NoOverlap',
    points: 93_287_782,
  },
  {
    id: 'section-2',
    label: 'Section 2',
    baseUrl: '/Potree/20250919_Hutchinson_Section2_L2_NoOverlap',
    points: 68_851_290,
  },
];

/** Returns true only if the URL serves a non-HTML file that actually exists. */
export async function fileExists(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    if (!res.ok) return false;
    // Guard against Vite SPA fallback silently returning index.html (text/html).
    const ct = res.headers.get('content-type') ?? '';
    if (ct.startsWith('text/html')) return false;
    return true;
  } catch {
    return false;
  }
}

function setOverlay(overlayEl: HTMLElement, message: string, detail = ''): void {
  overlayEl.innerHTML = `
    <strong>${message}</strong>
    ${detail ? `<span>${detail}</span>` : ''}
  `;
}

function showFallback(containerEl: HTMLElement): void {
  containerEl.innerHTML = `
    <div class="potree-placeholder">
      <div class="potree-icon">☁</div>
      <p>No point cloud data found</p>
      <small>Expected Potree 2 metadata under <code>data/Potree/</code></small>
    </div>`;
  console.warn('No Potree 2 metadata found under /Potree/ — showing placeholder');
}

function formatMillions(points: number): string {
  return `${(points / 1_000_000).toFixed(1)}M`;
}

function fitCameraToBox(
  THREE: typeof import('three'),
  camera: PerspectiveCamera,
  controls: OrbitControls,
  box: Box3
): void {
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z, 1);
  const fov = THREE.MathUtils.degToRad(camera.fov);
  const distance = Math.abs(maxDim / (2 * Math.tan(fov / 2))) * 1.35;

  camera.near = Math.max(distance / 1_000, 0.1);
  camera.far = distance * 20;
  camera.position.set(
    center.x + distance * 0.65,
    center.y - distance * 0.75,
    center.z + distance * 0.55
  );
  camera.lookAt(center);
  camera.updateProjectionMatrix();

  controls.target.copy(center);
  controls.update();
}

function createButton(label: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'potree-control-button';
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
}

async function initPotreeScene(containerEl: HTMLElement, availableDatasets: PotreeDataset[]): Promise<ViewerState> {
  const [THREE, controlsModule, potreeModule] = await Promise.all([
    import('three'),
    import('three/examples/jsm/controls/OrbitControls.js'),
    import('potree-loader'),
  ]);
  const { OrbitControls } = controlsModule;
  const { Potree } = potreeModule;

  containerEl.innerHTML = '';
  containerEl.classList.add('potree-active');

  const overlayEl = document.createElement('div');
  overlayEl.className = 'potree-status-panel';
  setOverlay(overlayEl, 'Loading Potree 3D model…', `${availableDatasets.length} section(s) detected`);
  containerEl.appendChild(overlayEl);

  const actionsEl = document.createElement('div');
  actionsEl.className = 'potree-actions';
  containerEl.appendChild(actionsEl);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0f1117);
  scene.add(new THREE.AmbientLight(0xffffff, 0.85));

  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100_000);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x0f1117, 1);
  renderer.domElement.className = 'potree-canvas';
  containerEl.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.screenSpacePanning = false;

  const potree = new Potree();
  potree.pointBudget = POINT_BUDGET;

  const pointClouds: PointCloudOctree[] = [];
  const loadedDatasets: PotreeDataset[] = [];
  const combinedBox = new THREE.Box3();
  const loadWarnings: string[] = [];

  for (const dataset of availableDatasets) {
    setOverlay(overlayEl, `Loading ${dataset.label}…`, `${formatMillions(dataset.points)} source points`);
    try {
      const pointCloud = await potree.loadPointCloud('metadata.json', (relativeUrl: string) => {
        const cleanRelative = relativeUrl.replace(/^\//, '');
        return `${dataset.baseUrl}/${cleanRelative}`;
      });

      pointCloud.name = dataset.label;
      pointCloud.material.size = 1.0;
      pointClouds.push(pointCloud);
      loadedDatasets.push(dataset);
      scene.add(pointCloud);

      pointCloud.updateMatrixWorld(true);
      const cloudBox = pointCloud.pcoGeometry.tightBoundingBox ?? pointCloud.pcoGeometry.boundingBox;
      combinedBox.union(cloudBox.clone().translate(pointCloud.position));
    } catch (error) {
      console.warn(`Failed to load ${dataset.label}`, error);
      loadWarnings.push(`${dataset.label} failed to load`);
    }
  }

  if (pointClouds.length === 0) {
    throw new Error('Potree metadata was found, but no point clouds could be loaded.');
  }

  fitCameraToBox(THREE, camera, controls, combinedBox);

  const loadedText = pointClouds.map((cloud) => cloud.name).join(' + ');
  setOverlay(
    overlayEl,
    `Loaded ${loadedText}`,
    `${formatMillions(loadedDatasets.reduce((sum, d) => sum + d.points, 0))} source points · budget ${formatMillions(POINT_BUDGET)}${loadWarnings.length ? ` · ${loadWarnings.join(', ')}` : ''}`
  );

  const state: ViewerState = {
    scene,
    camera,
    renderer,
    controls,
    potree,
    pointClouds,
    datasets: loadedDatasets,
    overlayEl,
    animationFrame: null,
    initialized: true,
  };

  function resize(): void {
    const width = containerEl.clientWidth || window.innerWidth;
    const height = containerEl.clientHeight || Math.max(window.innerHeight - 52, 1);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }

  actionsEl.appendChild(createButton('Fit to model', () => fitCameraToBox(THREE, camera, controls, combinedBox)));
  pointClouds.forEach((cloud) => {
    actionsEl.appendChild(createButton(`Toggle ${cloud.name}`, () => {
      cloud.visible = !cloud.visible;
    }));
  });

  resize();
  state.resizeObserver = new ResizeObserver(resize);
  state.resizeObserver.observe(containerEl);
  state.resizeHandler = resize;
  window.addEventListener('resize', resize);

  const animate = () => {
    controls.update();
    potree.updatePointClouds(pointClouds, camera, renderer);
    renderer.clear();
    renderer.render(scene, camera);
    state.animationFrame = requestAnimationFrame(animate);
  };
  animate();

  return state;
}

export function initViewer3D(containerEl: HTMLElement): Viewer3D {
  containerEl.style.display = 'none';

  let loaded = false;
  let loadPromise: Promise<void> | null = null;
  let state: ViewerState | null = null;

  async function tryLoad() {
    const availability = await Promise.all(
      POTREE_DATASETS.map(async (dataset) => ({
        dataset,
        exists: await fileExists(`${dataset.baseUrl}/metadata.json`),
      }))
    );
    const availableDatasets = availability.filter((entry) => entry.exists).map((entry) => entry.dataset);

    if (availableDatasets.length === 0) {
      showFallback(containerEl);
      return;
    }

    try {
      state = await initPotreeScene(containerEl, availableDatasets);
    } catch (error) {
      containerEl.innerHTML = `
        <div class="potree-placeholder">
          <div class="potree-icon">⚠</div>
          <p>Unable to load Potree 3D model</p>
          <small>${error instanceof Error ? error.message : String(error)}</small>
        </div>`;
      console.error('Potree viewer initialization failed', error);
    }
  }

  return {
    load() {
      containerEl.style.display = 'block';
      if (!loaded) {
        loaded = true;
        loadPromise = tryLoad();
      } else {
        this.resize();
      }
      void loadPromise;
    },
    resize() {
      if (!state) return;
      const width = containerEl.clientWidth || window.innerWidth;
      const height = containerEl.clientHeight || Math.max(window.innerHeight - 52, 1);
      state.camera.aspect = width / height;
      state.camera.updateProjectionMatrix();
      state.renderer.setSize(width, height, false);
      state.controls.update();
    },
    destroy() {
      if (state?.animationFrame != null) cancelAnimationFrame(state.animationFrame);
      state?.resizeObserver?.disconnect();
      if (state?.resizeHandler) window.removeEventListener('resize', state.resizeHandler);
      state?.pointClouds.forEach((cloud) => cloud.dispose());
      state?.renderer.dispose();
      state?.renderer.domElement.remove();
      state = null;
      loaded = false;
      loadPromise = null;
    },
  };
}
