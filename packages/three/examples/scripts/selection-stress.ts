// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import {
  SelectionManager,
  HighlightPass,
  HighlightPassJfa,
  PeerSelectionRegistry,
  MergedSelectionOverlay,
  type HighlightEntry
} from "../../src/index.ts";
import {
  createRenderer,
  createScene,
  createOrbitCamera,
  startLoop
} from "./utils/common.ts";
import { createExamplePane } from "./utils/example-switcher.ts";
import { mountPerformanceStats } from "./utils/performance-stats.ts";

// CONSTANTS
// Pointer must stay within this many CSS pixels between down/up to count as
// a click rather than an orbit drag.
const kClickDragThresholdPx = 4;
// World-space gap between instances in the cube grid - wide enough that the
// (fairly large) torus knot instances below don't overlap each other.
const kInstanceSpacing = 2.6;
const kDefaultInstanceCount = 100;
const kMaxInstanceCount = 3000;
// "outline" mode's "Random Selection > count" caps here regardless of
// `instanceCount` - see `randomSelectionMax`'s own doc comment for why.
const kOutlineSelectionCap = 100;

const canvas = document.querySelector("canvas") as HTMLCanvasElement;
const renderer = await createRenderer(canvas);

const scene = createScene("#101018");
scene.add(new THREE.AmbientLight("#ffffff", 0.7));

const keyLight = new THREE.DirectionalLight("#ffffff", 0.8);
keyLight.position.set(4, 6, 3);
scene.add(keyLight);

const { camera, controls } = createOrbitCamera(
  canvas,
  { x: 14, y: 12, z: 18 },
  { x: 0, y: 0, z: 0 }
);
camera.far = 500;
camera.updateProjectionMatrix();

const selectionManager = new SelectionManager();

const highlight = new HighlightPass(renderer, scene, camera);
const highlightJfa = new HighlightPassJfa(renderer, scene, camera);
const peerRegistry = new PeerSelectionRegistry();

type RenderMode = "outline" | "peerColors" | "peerColorsJfa";
let renderMode: RenderMode = "outline";
let activePeerNames: string[] = [];

function refreshPeerColors(): void {
  const localIds = selectedInstanceId === null ? randomSelectedInstanceIds : [selectedInstanceId];
  const localIdSet = new Set(localIds);
  const hoverId = hoveredInstanceId !== null && !localIdSet.has(hoveredInstanceId) ? hoveredInstanceId : null;

  const entries: HighlightEntry[] = localIds.map((instanceId) => {
    return {
      target: instancedMesh,
      instanceId,
      color: selectionManager.appearance.selected.color,
      priority: true
    };
  });
  if (hoverId !== null) {
    entries.push({
      target: instancedMesh,
      instanceId: hoverId,
      color: selectionManager.appearance.hovered.color
    });
  }

  for (const objectId of peerRegistry.selectedObjectIds()) {
    const instanceId = Number(objectId);
    if (localIdSet.has(instanceId) || instanceId === hoverId) {
      continue;
    }

    const peerId = peerRegistry.primarySelectorOf(objectId);
    if (peerId === null) {
      continue;
    }

    entries.push({ target: instancedMesh, instanceId, color: peerRegistry.colorOf(peerId) });
  }

  highlight.entries = entries;
  highlightJfa.entries = entries;
}

peerRegistry.addEventListener("peerSelectionChange", () => refreshPeerColors());

function clearPeerColors(): void {
  for (const peerName of activePeerNames) {
    peerRegistry.select(peerName, null);
  }
  activePeerNames = [];
}

function randomizePeerColors(
  peerCount: number
): void {
  clearPeerColors();
  if (peerCount <= 0 || instanceCount === 0) {
    return;
  }

  const picked = pickRandomInstanceIds(instanceCount, peerCount);
  picked.forEach((instanceId, index) => {
    const peerName = `Peer ${index + 1}`;
    activePeerNames.push(peerName);
    peerRegistry.select(peerName, String(instanceId));
  });
}

function nearestInstanceIdsToPosition(
  origin: THREE.Vector3,
  count: number,
  excludeId: number | null,
  want: number
): number[] {
  const distances: { id: number; distanceSquared: number; }[] = [];
  for (let i = 0; i < count; i++) {
    if (i === excludeId) {
      continue;
    }
    distances.push({ id: i, distanceSquared: gridPosition(i, count).distanceToSquared(origin) });
  }
  distances.sort((a, b) => a.distanceSquared - b.distanceSquared);

  return distances.slice(0, Math.max(want, 0)).map(({ id }) => id);
}

function clusterPeerColorsAroundSelection(
  peerCount: number
): void {
  if (instanceCount === 0) {
    return;
  }

  if (selectedInstanceId === null) {
    const [centerId] = nearestInstanceIdsToPosition(new THREE.Vector3(), instanceCount, null, 1);
    if (centerId === undefined) {
      return;
    }

    randomSelectedInstanceIds = [];
    selectedInstanceId = centerId;
    rebuildOverlays();
  }

  const localId = selectedInstanceId;
  if (localId === null) {
    return;
  }

  clearPeerColors();
  if (peerCount <= 0) {
    return;
  }

  const centerPosition = gridPosition(localId, instanceCount);
  const nearestIds = nearestInstanceIdsToPosition(centerPosition, instanceCount, localId, peerCount);
  nearestIds.forEach((instanceId, index) => {
    const peerName = `Peer ${index + 1}`;
    activePeerNames.push(peerName);
    peerRegistry.select(peerName, String(instanceId));
  });
}

const heavyGeometry = new THREE.TorusKnotGeometry(0.6, 0.22, 128, 24);
const heavyMaterial = new THREE.MeshStandardMaterial({ color: "#4a90d9" });

const instancedMesh = new THREE.InstancedMesh(heavyGeometry, heavyMaterial, kMaxInstanceCount);
instancedMesh.count = 0;
scene.add(instancedMesh);

let instanceCount = 0;

let selectedInstanceId: number | null = null;
let hoveredInstanceId: number | null = null;
let randomSelectedInstanceIds: number[] = [];

let selectionOverlay: MergedSelectionOverlay | null = null;
let hoverOverlay: MergedSelectionOverlay | null = null;

function clearSelectionOverlay(): void {
  selectionOverlay?.dispose();
  selectionOverlay = null;
}

function clearHoverOverlay(): void {
  hoverOverlay?.dispose();
  hoverOverlay = null;
}

function instanceProxyMesh(
  instanceId: number
): THREE.Mesh {
  const mesh = new THREE.Mesh(heavyGeometry);
  mesh.matrixAutoUpdate = false;
  instancedMesh.getMatrixAt(instanceId, mesh.matrix);
  mesh.updateMatrixWorld(true);

  return mesh;
}

function rebuildOverlays(): void {
  clearSelectionOverlay();
  clearHoverOverlay();

  const selectedIds = selectedInstanceId === null ? randomSelectedInstanceIds : [selectedInstanceId];
  const hoverSuppressed = hoveredInstanceId !== null && hoveredInstanceId === selectedInstanceId;
  const hoverIds = !hoverSuppressed && hoveredInstanceId !== null ? [hoveredInstanceId] : [];

  if (renderMode === "outline") {
    if (hoverIds.length > 0) {
      hoverOverlay = new MergedSelectionOverlay({
        parent: scene,
        targets: hoverIds.map(instanceProxyMesh),
        color: selectionManager.appearance.hovered.color,
        opacity: selectionManager.appearance.hovered.opacity,
        linewidth: selectionManager.appearance.outline.linewidth,
        xray: selectionManager.appearance.xray
      });
    }
    if (selectedIds.length > 0) {
      selectionOverlay = new MergedSelectionOverlay({
        parent: scene,
        targets: selectedIds.map(instanceProxyMesh),
        color: selectionManager.appearance.selected.color,
        opacity: 1,
        linewidth: selectionManager.appearance.outline.linewidth,
        xray: true
      });
    }
  }
  refreshPeerColors();
}

function clearRandomSelection(): void {
  randomSelectedInstanceIds = [];
  rebuildOverlays();
}

function randomizeSelection(
  count: number
): void {
  selectedInstanceId = null;
  randomSelectedInstanceIds = pickRandomInstanceIds(instanceCount, count);
  rebuildOverlays();
}

function pickRandomInstanceIds(
  count: number,
  pickCount: number
): number[] {
  const pool = Array.from({ length: count }, (_, index) => index);
  const n = Math.min(Math.max(pickCount, 0), pool.length);

  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(Math.random() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  return pool.slice(0, n);
}

function gridPosition(
  index: number,
  count: number
): THREE.Vector3 {
  const side = Math.ceil(Math.cbrt(count));
  const centerOffset = ((side - 1) * kInstanceSpacing) / 2;
  const x = index % side;
  const y = Math.floor(index / side) % side;
  const z = Math.floor(index / (side * side));

  return new THREE.Vector3(
    x * kInstanceSpacing - centerOffset,
    y * kInstanceSpacing - centerOffset,
    z * kInstanceSpacing - centerOffset
  );
}

function spawnInstances(
  count: number
): void {
  selectedInstanceId = null;
  hoveredInstanceId = null;
  randomSelectedInstanceIds = [];
  clearSelectionOverlay();
  clearHoverOverlay();
  clearPeerColors();

  const matrix = new THREE.Matrix4();
  for (let i = 0; i < count; i++) {
    matrix.setPosition(gridPosition(i, count));
    instancedMesh.setMatrixAt(i, matrix);
  }

  instancedMesh.instanceMatrix.needsUpdate = true;
  instancedMesh.count = count;
  instancedMesh.computeBoundingSphere();
  instanceCount = count;

  refreshPeerColors();
}

spawnInstances(kDefaultInstanceCount);

const raycaster = new THREE.Raycaster();
const pointerNdc = new THREE.Vector2();
let pointerDownAt: { x: number; y: number; } | null = null;

canvas.addEventListener("pointermove", (event) => {
  updatePointerNdc(event);
  updateHover();
});

canvas.addEventListener("pointerdown", (event) => {
  pointerDownAt = { x: event.clientX, y: event.clientY };
});

canvas.addEventListener("pointerup", (event) => {
  const downAt = pointerDownAt;
  pointerDownAt = null;

  if (!downAt) {
    return;
  }

  const movedPx = Math.hypot(event.clientX - downAt.x, event.clientY - downAt.y);
  if (movedPx > kClickDragThresholdPx) {
    return;
  }

  updatePointerNdc(event);
  handleClick();
});

function updatePointerNdc(
  event: PointerEvent
): void {
  const rect = canvas.getBoundingClientRect();
  pointerNdc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointerNdc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

function pickInstanceId(): number | null {
  raycaster.setFromCamera(pointerNdc, camera);
  const [hit] = raycaster.intersectObject(instancedMesh, false);

  return hit?.instanceId ?? null;
}

function updateHover(): void {
  const id = pickInstanceId();
  if (id === hoveredInstanceId) {
    return;
  }

  hoveredInstanceId = id;
  rebuildOverlays();
}

function handleClick(): void {
  randomSelectedInstanceIds = [];
  selectedInstanceId = pickInstanceId();
  rebuildOverlays();
}

const pane = createExamplePane({ title: "Stress" });
const performanceStats = mountPerformanceStats(renderer);

const stressFolder = pane.addFolder({ title: "Stress Test" });
const stressSettings = { instanceCount: kDefaultInstanceCount };
stressFolder
  .addBinding(stressSettings, "instanceCount", {
    label: "instances",
    min: 1,
    max: kMaxInstanceCount,
    step: 1
  })
  // Rebuild only on release, like Grid's own "extent" - rebuilding mid-drag
  // would rewrite thousands of instance matrices per slider tick.
  .on("change", ({ value, last }) => {
    if (last) {
      spawnInstances(Math.round(value));
      syncCountLimitsToInstanceCount();
    }
  });

const selectionFolder = pane.addFolder({ title: "Selection" });

const perfHintRow = document.createElement("jolly-property-row");
perfHintRow.label = "perf note";
perfHintRow.description = "\"outline\" re-merges geometry on every change and is local-only, so its own " +
  "\"count\" caps lower below; both \"peer colors\" modes never rebuild geometry, stay uncapped, and are the " +
  "only modes where peers are visible.";
selectionFolder.element.append(perfHintRow);

const modeSettings: { mode: RenderMode; } = { mode: renderMode };
selectionFolder
  .addBinding(modeSettings, "mode", {
    label: "mode",
    options: {
      outline: "outline",
      "peer colors (blur)": "peerColors",
      "peer colors (JFA)": "peerColorsJfa"
    } satisfies Record<string, RenderMode>
  })
  .on("change", ({ value }) => {
    renderMode = value;
    syncCountLimitsToInstanceCount();
    rebuildOverlays();
    updateControlVisibility();
  });

const xraySettings = { xray: selectionManager.appearance.xray };
const xrayBinding = selectionFolder
  .addBinding(xraySettings, "xray", { label: "x-ray (hover)" })
  .on("change", ({ value }) => {
    selectionManager.configure({ xray: value });
    rebuildOverlays();
  });

function updateControlVisibility(): void {
  xrayBinding.hidden = renderMode !== "outline";
  edgeThicknessBinding.hidden = renderMode !== "peerColors";
  ringThicknessBinding.hidden = renderMode !== "peerColorsJfa";
}

const randomFolder = pane.addFolder({ title: "Random Selection" });
const randomSettings = { count: 0 };
const randomCountBinding = randomFolder
  .addBinding(randomSettings, "count", {
    label: "count",
    min: 0,
    max: randomSelectionMax(),
    step: 1
  })
  .on("change", ({ value, last }) => {
    if (last) {
      randomizeSelection(Math.round(value));
    }
  });
randomFolder.addButton({ title: "Randomize" }).on("click", () => {
  randomizeSelection(Math.round(randomSettings.count));
});
randomFolder.addButton({ title: "Clear" }).on("click", () => {
  clearRandomSelection();
});

const peerColorsFolder = pane.addFolder({ title: "Peer Colors" });
const peerColorsSettings = { peerCount: 4 };
const peerCountBinding = peerColorsFolder
  .addBinding(peerColorsSettings, "peerCount", {
    label: "peer count",
    min: 0,
    max: instanceCount,
    step: 1
  })
  .on("change", ({ value, last }) => {
    if (last) {
      randomizePeerColors(Math.round(value));
    }
  });
peerColorsFolder.addButton({ title: "Randomize assignment" }).on("click", () => {
  randomizePeerColors(Math.round(peerColorsSettings.peerCount));
});

function randomSelectionMax(): number {
  return renderMode === "outline" ? Math.min(instanceCount, kOutlineSelectionCap) : instanceCount;
}

function syncCountLimitsToInstanceCount(): void {
  const randomMax = randomSelectionMax();
  (randomCountBinding.element as HTMLElementTagNameMap["jolly-slider"]).max = randomMax;
  randomSettings.count = Math.min(randomSettings.count, randomMax);
  randomCountBinding.refresh();
  if (randomSelectedInstanceIds.length > randomMax) {
    randomSelectedInstanceIds = randomSelectedInstanceIds.slice(0, randomMax);
  }

  (peerCountBinding.element as HTMLElementTagNameMap["jolly-slider"]).max = instanceCount;
  peerColorsSettings.peerCount = Math.min(peerColorsSettings.peerCount, instanceCount);
  peerCountBinding.refresh();
}

const clusterHintRow = document.createElement("jolly-property-row");
clusterHintRow.description = "Packs peers tightly around your selection to stress the priority guarantee.";
peerColorsFolder.element.append(clusterHintRow);
peerColorsFolder.addButton({ title: "Cluster around selection" }).on("click", () => {
  clusterPeerColorsAroundSelection(Math.round(peerColorsSettings.peerCount));
});

const highlightSettings = { edgeThickness: highlight.edgeThickness };
const edgeThicknessBinding = peerColorsFolder
  .addBinding(highlightSettings, "edgeThickness", { label: "blur edge thickness", min: 1, max: 10, step: 1 })
  .on("change", ({ value }) => {
    highlight.edgeThickness = value;
  });

const highlightJfaSettings = { ringThickness: highlightJfa.ringThickness };
const ringThicknessBinding = peerColorsFolder
  .addBinding(highlightJfaSettings, "ringThickness", { label: "JFA ring thickness (px)", min: 1, max: 10, step: 1 })
  .on("change", ({ value }) => {
    highlightJfa.ringThickness = value;
  });

updateControlVisibility();

startLoop({
  renderer,
  scene,
  camera,
  controls,
  render: () => {
    if (renderMode === "peerColors") {
      highlight.render();
    }
    else if (renderMode === "peerColorsJfa") {
      highlightJfa.render();
    }
    else {
      renderer.render(scene, camera);
    }
  },
  onBeforeRender: () => performanceStats.begin(),
  onAfterRender: () => performanceStats.end()
});
