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
import { STRESS_CLASS_ORDER, STRESS_COLORS, type StressClassKey } from './utils';

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
  scaleBar?: Group;
  combinedBox: Box3;
  selected?: SelectableRecord;
  raycaster: Raycaster;
  pointer: Vector2;
  clickHandler: (event: PointerEvent) => void;
  clock: import('three').Clock;
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
  setStressClassFilter(classes: string[]): void;
  clearSelection(): void;
  focusSelection(): void;
}

const POINT_BUDGET = 2_000_000;
const UNKNOWN_COLOR = '#999999';
const HUE_OFFSETS = [-15, -10, -5, 0, 5, 10, 15] as const;

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

function hslShift(hex: string, hueDelta: number): number {
  const clean = hex.replace('#', '').trim();
  const expanded = clean.length === 3
    ? clean.split('').map((char) => `${char}${char}`).join('')
    : clean;
  const parsed = Number.parseInt(expanded, 16);
  if (!Number.isFinite(parsed)) return 0x999999;

  const r = ((parsed >> 16) & 255) / 255;
  const g = ((parsed >> 8) & 255) / 255;
  const b = (parsed & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const lightness = (max + min) / 2;

  let hue = 0;
  let saturation = 0;
  if (delta > 0) {
    saturation = delta / (1 - Math.abs(2 * lightness - 1));
    if (max === r) hue = 60 * (((g - b) / delta) % 6);
    else if (max === g) hue = 60 * ((b - r) / delta + 2);
    else hue = 60 * ((r - g) / delta + 4);
  }

  hue = (hue + hueDelta) % 360;
  if (hue < 0) hue += 360;

  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const x = chroma * (1 - Math.abs((hue / 60) % 2 - 1));
  const m = lightness - chroma / 2;
  let rp = 0;
  let gp = 0;
  let bp = 0;

  if (hue < 60) [rp, gp, bp] = [chroma, x, 0];
  else if (hue < 120) [rp, gp, bp] = [x, chroma, 0];
  else if (hue < 180) [rp, gp, bp] = [0, chroma, x];
  else if (hue < 240) [rp, gp, bp] = [0, x, chroma];
  else if (hue < 300) [rp, gp, bp] = [x, 0, chroma];
  else [rp, gp, bp] = [chroma, 0, x];

  const toByte = (value: number) => Math.min(255, Math.max(0, Math.round((value + m) * 255)));
  return (toByte(rp) << 16) | (toByte(gp) << 8) | toByte(bp);
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

/**
 * Generates a soft circular foliage billboard texture on a canvas.
 * Pure white so it can be tinted to any stress-class color via SpriteMaterial.color.
 * The peripheral bumps break up the silhouette into a natural leafy outline.
 */
function createFoliageTexture(THREE: typeof import('three')): import('three').CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const cx = size / 2;
  const cy = size / 2;

  // Main body: radial fade from opaque centre to transparent edge
  const body = ctx.createRadialGradient(cx, cy, 0, cx, cy, cx);
  body.addColorStop(0,    'rgba(255,255,255,1.0)');
  body.addColorStop(0.45, 'rgba(255,255,255,0.95)');
  body.addColorStop(0.72, 'rgba(255,255,255,0.50)');
  body.addColorStop(1.0,  'rgba(255,255,255,0.0)');
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(cx, cy, cx, 0, Math.PI * 2);
  ctx.fill();

  // Peripheral leafy bump clusters — 8 positions, offset to break the circle silhouette
  const bumpDeg = [0, 45, 90, 135, 180, 225, 270, 315];
  for (const deg of bumpDeg) {
    const rad = (deg * Math.PI) / 180;
    const bx = cx + Math.cos(rad) * cx * 0.40;
    const by = cy + Math.sin(rad) * cy * 0.40;
    const br = cx * 0.20;
    const bg = ctx.createRadialGradient(bx, by, 0, bx, by, br);
    bg.addColorStop(0,   'rgba(255,255,255,0.70)');
    bg.addColorStop(1.0, 'rgba(255,255,255,0.0)');
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

type SpriteMaterialPool = Map<string, import('three').SpriteMaterial>;

function createSpriteMaterialPool(
  THREE: typeof import('three'),
  foliageTex: import('three').CanvasTexture
): SpriteMaterialPool {
  // SpriteMaterial pool: seven hue variants for each stress class, shared by all trees.
  const spriteMaterials: SpriteMaterialPool = new Map();
  STRESS_CLASS_ORDER.forEach((stressClass) => {
    HUE_OFFSETS.forEach((hueDelta) => {
      const spriteMaterial = new THREE.SpriteMaterial({
        map: foliageTex,
        // SpriteMaterial.color accepts a 0xRRGGBB integer, so hslShift returns a number.
        color: hslShift(STRESS_COLORS[stressClass], hueDelta),
        transparent: true,
        opacity: 0.90,
        depthWrite: false,
      });
      spriteMaterials.set(`${stressClass}:${hueDelta}`, spriteMaterial);
    });
  });
  return spriteMaterials;
}

function createShadowTexture(THREE: typeof import('three')): import('three').CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(0,0,0,1)');
  gradient.addColorStop(0.65, 'rgba(0,0,0,0.55)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function createTreeGroup(
  THREE: typeof import('three'),
  trees: TreeFeature3D[],
  combinedBox: Box3
): Group {
  const group = new THREE.Group();
  group.name = 'Procedural tree analysis layer';

  // Shared trunk geometry — cylinder, Z-up (rotated in place)
  const trunkGeometry = new THREE.CylinderGeometry(0.3, 0.5, 1, 7);
  const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x5c3317, roughness: 0.92 });

  // Single foliage texture shared across all sprites; tinted per stress class via material.color
  const foliageTex = createFoliageTexture(THREE);
  // SpriteMaterial variants are pre-baked once, then reused by deterministic tree position.
  const spriteMaterials = createSpriteMaterialPool(THREE, foliageTex);
  // Fallback SpriteMaterial is shared by every unexpected class, never created per tree.
  const fallbackSpriteMaterial = new THREE.SpriteMaterial({
    map: foliageTex,
    color: hslShift(UNKNOWN_COLOR, 0),
    transparent: true,
    opacity: 0.90,
    depthWrite: false,
  });
  const shadowGeometry = new THREE.PlaneGeometry(1, 1);
  const shadowMaterial = new THREE.MeshBasicMaterial({
    color: 0x000000,
    map: createShadowTexture(THREE),
    opacity: 0.25,
    transparent: true,
    depthWrite: false,
  });

  trees.forEach((tree) => {
    const renderTree: TreeFeature3D = {
      ...tree,
      scenePosition: tree.scenePosition,
    };
    const variantIndex = Math.abs(
      Math.round(renderTree.scenePosition[0] * 3.7 + renderTree.scenePosition[1] * 1.3)
    ) % HUE_OFFSETS.length;
    const hueDelta = HUE_OFFSETS[variantIndex];
    const spriteMat = spriteMaterials.get(`${renderTree.stressClass}:${hueDelta}`) ?? fallbackSpriteMaterial;

    const treeObject = new THREE.Group();
    const trunkH  = Math.max(tree.height * 0.42, 2.5);
    const canopyH = Math.max(tree.height * 0.65, 4.5);
    const radius  = Math.min(Math.max(tree.crownRadius, 1.5), 8.0);

    // ── Trunk ──────────────────────────────────────────────────────────────
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.scale.set(Math.max(radius * 0.18, 0.4), trunkH, Math.max(radius * 0.18, 0.4));
    trunk.rotation.x = Math.PI / 2;
    trunk.position.z = trunkH / 2;
    markSelectable(trunk, { type: 'tree', record: renderTree });

    // ── Canopy — three billboard sprites layered for depth ────────────────
    // 1) Lower skirt: wide and flat, anchors the crown at the break-of-branch
    const lowSprite = new THREE.Sprite(spriteMat);
    const lowSize   = radius * 1.55;
    lowSprite.scale.set(lowSize, lowSize * 0.72, 1);
    lowSprite.position.set(0, 0, trunkH + canopyH * 0.20);
    markSelectable(lowSprite, { type: 'tree', record: renderTree });

    // 2) Main crown: largest blob, centred on the canopy mass
    const mainSprite = new THREE.Sprite(spriteMat);
    const mainSize   = radius * 1.90;
    mainSprite.scale.set(mainSize, mainSize * 0.95, 1);
    mainSprite.position.set(0, 0, trunkH + canopyH * 0.48);
    markSelectable(mainSprite, { type: 'tree', record: renderTree });

    // 3) Top accent: smaller blob, slightly offset — breaks symmetry, adds height
    const topSprite = new THREE.Sprite(spriteMat);
    const topSize   = radius * 1.05;
    topSprite.scale.set(topSize, topSize, 1);
    topSprite.position.set(radius * 0.12, 0, trunkH + canopyH * 0.82);
    markSelectable(topSprite, { type: 'tree', record: renderTree });

    const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
    shadow.scale.set(radius * 1.8, radius * 1.8, 1);
    shadow.position.set(0, 0, 0.05);

    treeObject.position.set(renderTree.scenePosition[0], renderTree.scenePosition[1], renderTree.scenePosition[2]);
    markSelectable(treeObject, { type: 'tree', record: renderTree });
    treeObject.userData.stressClass = renderTree.stressClass;
    treeObject.add(shadow, trunk, lowSprite, mainSprite, topSprite);
    if (radius > 5) {
      const extraSprite = new THREE.Sprite(spriteMat);
      const extraSize = radius * 1.2;
      extraSprite.scale.set(extraSize, extraSize * 0.6, 1);
      extraSprite.position.set(-radius * 0.18, 0, trunkH + canopyH * 0.35);
      markSelectable(extraSprite, { type: 'tree', record: renderTree });
      treeObject.add(extraSprite);
    }
    treeObject.userData.windPhase = (renderTree.scenePosition[0] * 0.17 +
                                      renderTree.scenePosition[1] * 0.11) % (Math.PI * 2);
    treeObject.userData.windFreq = 0.55 + ((Math.abs(renderTree.scenePosition[0]) % 7) / 7) * 0.30;
    treeObject.userData.windAmp = 0.12 + ((Math.abs(renderTree.scenePosition[1]) % 5) / 5) * 0.10;
    for (const child of treeObject.children) {
      if ((child as { isSprite?: boolean }).isSprite) {
        child.userData.baseX = child.position.x;
        child.userData.baseY = child.position.y;
      }
    }
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

function createTextSprite(
  THREE: typeof import('three'),
  label: string
): import('three').Sprite {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 48;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = 'rgba(0,0,0,0.58)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.font = '700 24px Segoe UI, Arial, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(16, 6, 1);
  return sprite;
}

function createScaleBar(THREE: typeof import('three')): Group {
  const scaleBar = new THREE.Group();
  scaleBar.name = '50 m scale reference';
  const bar = new THREE.Mesh(
    new THREE.BoxGeometry(50, 0.3, 0.3),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
  );
  const label = createTextSprite(THREE, '50 m');
  label.position.set(25, 0, 4);
  scaleBar.add(bar, label);
  return scaleBar;
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
  camera.up.set(0, 0, 1);   // UTM data is Z-up; override Three.js Y-up default
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
  controls.minPolarAngle = 0;
  controls.maxPolarAngle = Math.PI / 2;

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
      const worldCloudBox = cloudBox.clone().translate(pointCloud.position);
      combinedBox.union(worldCloudBox);
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

  const clock = new THREE.Clock();
  const scaleBar = createScaleBar(THREE);
  scene.add(scaleBar);
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
    scaleBar,
    combinedBox,
    raycaster: new THREE.Raycaster(),
    pointer: new THREE.Vector2(),
    clickHandler: () => undefined,
    clock,
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
  actionsEl.appendChild(createButton('HD / Performance', () => {
    potree.pointBudget = potree.pointBudget === POINT_BUDGET ? 500_000 : POINT_BUDGET;
    setOverlay(
      overlayEl,
      'Point budget updated',
      potree.pointBudget === POINT_BUDGET ? 'HD mode: 2.0M points' : 'Performance mode: 0.5M points'
    );
  }));

  resize();
  state.resizeObserver = new ResizeObserver(resize);
  state.resizeObserver.observe(containerEl);
  state.resizeHandler = resize;
  window.addEventListener('resize', resize);

  await addAnalysisLayer(THREE, state, actionsEl);

  const animate = () => {
    const elapsed = state.clock.getElapsedTime();
    controls.update();
    state.scaleBar?.position.copy(controls.target).add(new THREE.Vector3(-30, -30, 0));

    if (state.treeGroup?.visible) {
      for (const treeObj of state.treeGroup.children) {
        const phase = (treeObj.userData.windPhase as number) ?? 0;
        const freq = (treeObj.userData.windFreq as number) ?? 0.6;
        const amp = (treeObj.userData.windAmp as number) ?? 0.15;
        const swayX = Math.sin(elapsed * freq + phase) * amp;
        const swayY = Math.sin(elapsed * freq * 0.7 + phase) * amp * 0.6;

        for (const child of treeObj.children) {
          if ((child as { isSprite?: boolean }).isSprite) {
            child.position.x = ((child.userData.baseX as number | undefined) ?? 0) + swayX;
            child.position.y = ((child.userData.baseY as number | undefined) ?? 0) + swayY;
          }
        }
      }
    }

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
    setStressClassFilter(classes: string[]) {
      const active = new Set(classes);
      state?.treeGroup?.children.forEach((treeObject) => {
        const stressClass = treeObject.userData.stressClass as string | undefined;
        treeObject.visible = !stressClass || active.has(stressClass);
      });
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
      if (state?.scaleBar) disposeObject(state.scaleBar);
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
