import type {
  Box3,
  BufferGeometry,
  Group,
  Material,
  Mesh,
  Object3D,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Vector2,
  WebGLRenderer,
} from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { PointCloudOctree, Potree } from 'potree-loader';
import {
  loadTreeData3D,
  selectionDetailsForFieldPoint,
  selectionDetailsForTree,
  type FieldPoint3D,
  type SelectionDetails,
  type TreeFeature3D,
} from './treeData3d';
import { STRESS_COLORS, type StressClassKey } from './utils';

interface PotreeDataset {
  id: string;
  label: string;
  baseUrl: string;
  points: number;
}

type SelectableRecord =
  | { type: 'tree'; record: TreeFeature3D }
  | { type: 'field-point'; record: FieldPoint3D };

interface ViewerState {
  scene: Scene;
  camera: PerspectiveCamera;
  renderer: WebGLRenderer;
  controls: OrbitControls;
  potree: Potree;
  pointClouds: PointCloudOctree[];
  datasets: PotreeDataset[];
  overlayEl: HTMLElement;
  selectionEl: HTMLElement;
  treeGroup?: Group;
  fieldPointGroup?: Group;
  selectionMarker?: Mesh;
  combinedBox: Box3;
  selected?: SelectableRecord;
  raycaster: Raycaster;
  pointer: Vector2;
  clickHandler: (event: PointerEvent) => void;
  animationFrame: number | null;
  resizeObserver?: ResizeObserver;
  resizeHandler?: () => void;
  initialized: boolean;
}

export interface Viewer3D {
  load(): void;
  resize(): void;
  destroy(): void;
  setTreesVisible(visible: boolean): void;
  setFieldPointsVisible(visible: boolean): void;
  clearSelection(): void;
  focusSelection(): void;
}

const POINT_BUDGET = 2_000_000;
const UNKNOWN_COLOR = '#999999';

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
  console.warn('No Potree 2 metadata found under /Potree/ - showing placeholder');
}

function formatMillions(points: number): string {
  return `${(points / 1_000_000).toFixed(1)}M`;
}

function colorForClass(stressClass: StressClassKey | 'Unknown'): string {
  return stressClass === 'Unknown' ? UNKNOWN_COLOR : STRESS_COLORS[stressClass];
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

function topView(
  THREE: typeof import('three'),
  camera: PerspectiveCamera,
  controls: OrbitControls,
  box: Box3
): void {
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const distance = Math.max(size.x, size.y, 200) * 1.1;
  camera.position.set(center.x, center.y, center.z + distance);
  camera.near = 0.1;
  camera.far = Math.max(distance * 4, 10_000);
  camera.lookAt(center);
  camera.updateProjectionMatrix();
  controls.target.copy(center);
  controls.update();
}

function focusPosition(
  THREE: typeof import('three'),
  camera: PerspectiveCamera,
  controls: OrbitControls,
  position: [number, number, number],
  distance = 42
): void {
  const target = new THREE.Vector3(position[0], position[1], position[2]);
  camera.position.set(target.x + distance, target.y - distance, target.z + distance * 0.8);
  camera.lookAt(target);
  camera.updateProjectionMatrix();
  controls.target.copy(target);
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

function detailsHtml(details: SelectionDetails): string {
  const groups = details.groups.map((group) => `
    <section>
      <strong>${group.title}</strong>
      ${group.rows.map((row) => `
        <div class="selection-row">
          <span>${row.label}</span>
          <b>${row.value}</b>
        </div>
      `).join('')}
    </section>
  `).join('');

  return `<h3>${details.title}</h3>${groups}`;
}

function setSelectionPanel(selectionEl: HTMLElement, details?: SelectionDetails): void {
  selectionEl.innerHTML = details
    ? detailsHtml(details)
    : '<h3>Tree analysis</h3><p>Select a procedural tree or tested field point.</p>';
}

function markSelectable(object: Object3D, selectable: SelectableRecord): void {
  object.userData.selectable = selectable;
}

function getSelectable(object: Object3D | null): SelectableRecord | undefined {
  let current: Object3D | null = object;
  while (current) {
    const selectable = current.userData.selectable as SelectableRecord | undefined;
    if (selectable) return selectable;
    current = current.parent;
  }
  return undefined;
}

function disposeObject(object: Object3D): void {
  object.traverse((child) => {
    const mesh = child as Mesh;
    const geometry = mesh.geometry as BufferGeometry | undefined;
    const material = mesh.material as Material | Material[] | undefined;
    geometry?.dispose();
    if (Array.isArray(material)) material.forEach((entry) => entry.dispose());
    else material?.dispose();
  });
}

function createTreeGroup(
  THREE: typeof import('three'),
  trees: TreeFeature3D[],
  combinedBox: Box3
): Group {
  const group = new THREE.Group();
  group.name = 'Procedural tree analysis layer';

  const trunkGeometry = new THREE.CylinderGeometry(0.38, 0.52, 1, 8);
  const canopyGeometry = new THREE.ConeGeometry(1, 1.6, 10);
  const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x7b4a22, roughness: 0.85 });
  const canopyMaterials = new Map<string, Material>();

  trees.forEach((tree) => {
    const materialKey = tree.stressClass;
    let canopyMaterial = canopyMaterials.get(materialKey);
    if (!canopyMaterial) {
      canopyMaterial = new THREE.MeshStandardMaterial({
        color: colorForClass(tree.stressClass),
        roughness: 0.72,
        metalness: 0.02,
      });
      canopyMaterials.set(materialKey, canopyMaterial);
    }

    const treeObject = new THREE.Group();
    const trunkHeight = Math.max(tree.height * 0.44, 2.2);
    const canopyHeight = Math.max(tree.height * 0.7, 4);
    const radius = Math.min(Math.max(tree.crownRadius, 1.2), 7);

    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.scale.set(Math.max(radius * 0.2, 0.45), trunkHeight, Math.max(radius * 0.2, 0.45));
    trunk.rotation.x = Math.PI / 2;
    trunk.position.z = trunkHeight / 2;
    trunk.castShadow = false;
    markSelectable(trunk, { type: 'tree', record: tree });

    const canopy = new THREE.Mesh(canopyGeometry, canopyMaterial);
    canopy.scale.set(radius, canopyHeight, radius);
    canopy.rotation.x = Math.PI / 2;
    canopy.position.z = trunkHeight + canopyHeight / 2 - 0.4;
    markSelectable(canopy, { type: 'tree', record: tree });

    treeObject.position.set(tree.scenePosition[0], tree.scenePosition[1], tree.scenePosition[2]);
    markSelectable(treeObject, { type: 'tree', record: tree });
    treeObject.add(trunk, canopy);
    group.add(treeObject);
    combinedBox.expandByPoint(treeObject.position);
  });

  return group;
}

function createFieldPointGroup(
  THREE: typeof import('three'),
  fieldPoints: FieldPoint3D[],
  combinedBox: Box3
): Group {
  const group = new THREE.Group();
  group.name = 'Tested tree field points';
  const geometry = new THREE.SphereGeometry(1.7, 12, 8);
  const materials = new Map<string, Material>();

  fieldPoints.forEach((point) => {
    let material = materials.get(point.stressClass);
    if (!material) {
      material = new THREE.MeshStandardMaterial({
        color: colorForClass(point.stressClass),
        emissive: colorForClass(point.stressClass),
        emissiveIntensity: 0.2,
        roughness: 0.5,
      });
      materials.set(point.stressClass, material);
    }
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(point.scenePosition[0], point.scenePosition[1], point.scenePosition[2] + 3);
    markSelectable(mesh, { type: 'field-point', record: point });
    group.add(mesh);
    combinedBox.expandByPoint(mesh.position);
  });

  return group;
}

async function addAnalysisLayer(
  THREE: typeof import('three'),
  state: ViewerState,
  actionsEl: HTMLElement
): Promise<void> {
  try {
    const { trees, fieldPoints } = await loadTreeData3D();
    state.treeGroup = createTreeGroup(THREE, trees, state.combinedBox);
    state.fieldPointGroup = createFieldPointGroup(THREE, fieldPoints, state.combinedBox);
    state.scene.add(state.treeGroup, state.fieldPointGroup);

    const markerGeometry = new THREE.TorusGeometry(6, 0.35, 8, 32);
    const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    state.selectionMarker = new THREE.Mesh(markerGeometry, markerMaterial);
    state.selectionMarker.rotation.x = Math.PI / 2;
    state.selectionMarker.visible = false;
    state.scene.add(state.selectionMarker);

    actionsEl.appendChild(createButton('Toggle Trees', () => {
      state.treeGroup!.visible = !state.treeGroup!.visible;
    }));
    actionsEl.appendChild(createButton('Toggle Field Points', () => {
      state.fieldPointGroup!.visible = !state.fieldPointGroup!.visible;
    }));

    setOverlay(
      state.overlayEl,
      'Loaded 3D tree analysis',
      `${trees.length.toLocaleString()} procedural trees · ${fieldPoints.length.toLocaleString()} tested field points`
    );
  } catch (error) {
    console.warn('3D tree analysis layer failed to load', error);
    setOverlay(
      state.overlayEl,
      'Loaded point cloud',
      `Tree analysis data unavailable: ${error instanceof Error ? error.message : String(error)}`
    );
  }
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
  setOverlay(overlayEl, 'Loading Potree 3D model...', `${availableDatasets.length} section(s) detected`);
  containerEl.appendChild(overlayEl);

  const helpEl = document.createElement('div');
  helpEl.className = 'potree-help-panel';
  helpEl.innerHTML = `
    <strong>3D controls</strong>
    <span>Left drag rotate · Right drag pan · Wheel zoom</span>
    <span>Click a tree or field point to inspect data</span>
  `;
  containerEl.appendChild(helpEl);

  const selectionEl = document.createElement('div');
  selectionEl.className = 'potree-selection-panel';
  setSelectionPanel(selectionEl);
  containerEl.appendChild(selectionEl);

  const actionsEl = document.createElement('div');
  actionsEl.className = 'potree-actions';
  containerEl.appendChild(actionsEl);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0f1117);
  scene.add(new THREE.AmbientLight(0xffffff, 0.78));
  const directional = new THREE.DirectionalLight(0xffffff, 0.52);
  directional.position.set(0.5, -0.8, 1.2);
  scene.add(directional);

  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100_000);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x0f1117, 1);
  renderer.domElement.className = 'potree-canvas';
  containerEl.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.12;
  controls.screenSpacePanning = false;
  controls.minDistance = 8;
  controls.maxDistance = 5_000;

  const potree = new Potree();
  potree.pointBudget = POINT_BUDGET;

  const pointClouds: PointCloudOctree[] = [];
  const loadedDatasets: PotreeDataset[] = [];
  const combinedBox = new THREE.Box3();
  const loadWarnings: string[] = [];

  for (const dataset of availableDatasets) {
    setOverlay(overlayEl, `Loading ${dataset.label}...`, `${formatMillions(dataset.points)} source points`);
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
    selectionEl,
    combinedBox,
    raycaster: new THREE.Raycaster(),
    pointer: new THREE.Vector2(),
    clickHandler: () => undefined,
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

  function select(selectable: SelectableRecord): void {
    state.selected = selectable;
    if (selectable.type === 'tree') {
      setSelectionPanel(selectionEl, selectionDetailsForTree(selectable.record));
      state.selectionMarker?.position.set(
        selectable.record.scenePosition[0],
        selectable.record.scenePosition[1],
        selectable.record.scenePosition[2] + 0.3
      );
    } else {
      setSelectionPanel(selectionEl, selectionDetailsForFieldPoint(selectable.record));
      state.selectionMarker?.position.set(
        selectable.record.scenePosition[0],
        selectable.record.scenePosition[1],
        selectable.record.scenePosition[2] + 3
      );
    }
    if (state.selectionMarker) state.selectionMarker.visible = true;
  }

  state.clickHandler = (event: PointerEvent) => {
    const rect = renderer.domElement.getBoundingClientRect();
    state.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    state.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    state.raycaster.setFromCamera(state.pointer, camera);
    const targets: Object3D[] = [];
    if (state.treeGroup?.visible) targets.push(state.treeGroup);
    if (state.fieldPointGroup?.visible) targets.push(state.fieldPointGroup);
    const hit = state.raycaster.intersectObjects(targets, true)[0];
    const selectable = getSelectable(hit?.object ?? null);
    if (selectable) select(selectable);
  };
  renderer.domElement.addEventListener('pointerdown', state.clickHandler);

  actionsEl.appendChild(createButton('Fit All', () => fitCameraToBox(THREE, camera, controls, combinedBox)));
  actionsEl.appendChild(createButton('Top View', () => topView(THREE, camera, controls, combinedBox)));
  actionsEl.appendChild(createButton('Oblique View', () => fitCameraToBox(THREE, camera, controls, combinedBox)));
  actionsEl.appendChild(createButton('Focus Selected', () => {
    if (!state.selected) return;
    const position = state.selected.type === 'tree'
      ? state.selected.record.scenePosition
      : state.selected.record.scenePosition;
    focusPosition(THREE, camera, controls, position);
  }));
  actionsEl.appendChild(createButton('Reset Selection', () => {
    state.selected = undefined;
    if (state.selectionMarker) state.selectionMarker.visible = false;
    setSelectionPanel(selectionEl);
  }));
  actionsEl.appendChild(createButton('Toggle Point Cloud', () => {
    pointClouds.forEach((cloud) => {
      cloud.visible = !cloud.visible;
    });
  }));
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

  await addAnalysisLayer(THREE, state, actionsEl);

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

  const api: Viewer3D = {
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
    setTreesVisible(visible: boolean) {
      if (state?.treeGroup) state.treeGroup.visible = visible;
    },
    setFieldPointsVisible(visible: boolean) {
      if (state?.fieldPointGroup) state.fieldPointGroup.visible = visible;
    },
    clearSelection() {
      if (!state) return;
      state.selected = undefined;
      if (state.selectionMarker) state.selectionMarker.visible = false;
      setSelectionPanel(state.selectionEl);
    },
    focusSelection() {
      if (!state?.selected) return;
      const position = state.selected.type === 'tree'
        ? state.selected.record.scenePosition
        : state.selected.record.scenePosition;
      void import('three').then((THREE) => focusPosition(THREE, state!.camera, state!.controls, position));
    },
    destroy() {
      if (state?.animationFrame != null) cancelAnimationFrame(state.animationFrame);
      state?.resizeObserver?.disconnect();
      if (state?.resizeHandler) window.removeEventListener('resize', state.resizeHandler);
      if (state?.clickHandler) state.renderer.domElement.removeEventListener('pointerdown', state.clickHandler);
      if (state?.treeGroup) disposeObject(state.treeGroup);
      if (state?.fieldPointGroup) disposeObject(state.fieldPointGroup);
      if (state?.selectionMarker) disposeObject(state.selectionMarker);
      state?.pointClouds.forEach((cloud) => cloud.dispose());
      state?.renderer.dispose();
      state?.renderer.domElement.remove();
      state = null;
      loaded = false;
      loadPromise = null;
    },
  };

  return api;
}
