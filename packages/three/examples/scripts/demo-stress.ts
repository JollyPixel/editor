// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import {
  SelectionManager,
  ColoredOutlinePass,
  PeerSelectionRegistry,
  MergedSelectionOverlay,
  type ColoredOutlineEntry
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

/**
 * `SelectionManager` here is a pure settings holder (color/hoverColor/xray/
 * outlineOptions, all already wired to the "Selection" pane folder below) -
 * never `register`/`select`/`hover`. Unlike `demo-selection.ts`, the grid
 * below is one `THREE.InstancedMesh` (see its own comment), which has no
 * per-instance `Object3D` to register: `SelectionManager`'s id-based model
 * fundamentally assumes one scene object per selectable thing, so this demo
 * drives the overlay classes / `coloredOutline` directly for every
 * interaction (click-select, hover, Random Selection alike) instead - the
 * same "bypass" shape Random Selection already used even before this file's
 * InstancedMesh conversion, now used for the single click-select and hover
 * too. Its own `technique` is deliberately unused here - see `RenderMode`
 * below for why this demo needs a wider concept than `SelectionTechnique`
 * covers.
 */
const selectionManager = new SelectionManager();

/**
 * Owns its own `RenderPipeline` - `renderMode` below picks whether this or
 * a plain `renderer.render(scene, camera)` drives the frame.
 */
const coloredOutline = new ColoredOutlinePass(renderer, scene, camera);
const peerRegistry = new PeerSelectionRegistry();

/**
 * One unified mode for both the local selection *and* peers, instead of the
 * two separate, only loosely related controls this file used to have
 * (`SelectionManager`'s own `technique`, plus a standalone "Peer Colors
 * enabled" toggle). Peers can only ever be represented by `ColoredOutlinePass`
 * in this file - an `InstancedMesh` instance has no real `THREE.Object3D` of
 * its own for `PeerSelectionOverlays`-style per-object techniques to attach
 * to - so "which local technique is active" and "are peers visible" were
 * never really independent axes to begin with; treating them as one
 * dropdown makes that explicit instead of hiding it behind two controls that
 * could disagree.
 * - `"outline"`: local-only, no peers - `MergedSelectionOverlay`, the batched
 *   equivalent of `SelectionManager`'s own `"outline"` per-object technique,
 *   applied to `instanceProxyMesh`. The *only* mechanism rendering the local
 *   selection/hover in this mode.
 * - `"peerColors"`: `coloredOutline` drives the frame. The local selection
 *   renders via its own `priority` entry, hover via its own plain entry (see
 *   `refreshPeerColors`) - reliable on its own, no separate overlay needed.
 *   Not `isolated` here unlike `PeerColoredOutlinePass`'s own hover entry
 *   (see `ColoredOutlineEntry.isolated`'s own doc comment) - that option
 *   isn't supported alongside `instanceId`, which every entry in this grid
 *   uses. Every peer renders too, in its own color, all in the same
 *   postprocess ring style as the local selection - the only mode where
 *   peers are visible at all.
 */
type RenderMode = "outline" | "peerColors";
let renderMode: RenderMode = "outline";
let activePeerNames: string[] = [];

/**
 * Replaces `PeerColoredOutlinePass` for this demo rather than using it
 * directly (unlike an earlier version of this file) - `PeerColoredOutlinePass`
 * resolves every id through `SelectionManager.targetFor`, which only ever
 * returns a whole `SelectableObject`, never "one instance of an
 * `InstancedMesh`" (see `ColoredOutlineEntry.instanceId`'s own doc comment
 * for why that's a distinct concept a whole-object entry model has no seam
 * for). This grid has no whole-object selectable things left to hand it, so
 * this function takes over `PeerColoredOutlinePass`'s exact job (local
 * selection wins and is `priority`, local hover shows in its own color,
 * peers read in their primary selector's color) directly against instance
 * ids instead - `peerRegistry` itself is unaffected (purely id-based
 * bookkeeping, agnostic to what an id refers to, same as always).
 */
function refreshPeerColors(): void {
  const localIds = selectedInstanceId === null ? randomSelectedInstanceIds : [selectedInstanceId];
  const localIdSet = new Set(localIds);
  const hoverId = hoveredInstanceId !== null && !localIdSet.has(hoveredInstanceId) ? hoveredInstanceId : null;

  const entries: ColoredOutlineEntry[] = localIds.map((instanceId) => {
    return { target: instancedMesh, instanceId, color: selectionManager.color, priority: true };
  });
  if (hoverId !== null) {
    entries.push({ target: instancedMesh, instanceId: hoverId, color: selectionManager.hoverColor });
  }

  for (const objectId of peerRegistry.selectedObjectIds()) {
    const instanceId = Number(objectId);
    if (localIdSet.has(instanceId) || instanceId === hoverId) {
      // "My own selection/hover wins visually for myself" - same rule
      // `PeerColoredOutlinePass` itself documents.
      continue;
    }

    const peerId = peerRegistry.primarySelectorOf(objectId);
    if (peerId === null) {
      continue;
    }

    entries.push({ target: instancedMesh, instanceId, color: peerRegistry.colorOf(peerId) });
  }

  coloredOutline.setEntries(entries);
}

peerRegistry.addEventListener("peerSelectionChange", () => refreshPeerColors());

/**
 * Deselects every synthetic peer this demo has ever assigned -
 * `peerRegistry.select(name, null)` only actually dispatches (and triggers
 * `refreshPeerColors` via the listener above) when it changes something, so
 * this is safe to call even when some/all peers are already empty.
 */
function clearPeerColors(): void {
  for (const peerName of activePeerNames) {
    peerRegistry.select(peerName, null);
  }
  activePeerNames = [];
}

/**
 * Assigns `peerCount` synthetic peers ("Peer 1".."Peer N") each their own
 * single random instance id, via the real `peerRegistry.select` - matching
 * `PeerSelectionRegistry`'s actual one-selection-per-peer model (a peer
 * having many simultaneous selections isn't representable there any more
 * than the local user's own selection is, see `SelectionManager`'s own doc
 * comment). "peer count" is therefore also directly "how many simultaneously
 * peer-highlighted instances exist" - the real stress knob for a many-peers
 * scenario.
 */
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

/**
 * The `want` instance ids (within `[0, count)`, `excludeId` skipped) whose
 * `gridPosition` is nearest `origin`, nearest-first. O(count log count) -
 * cheap enough to call once per button click even at `kMaxInstanceCount`,
 * not something to run per frame.
 */
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

/**
 * "Peer rendering" counterpart to `randomizePeerColors` - instead of
 * spreading `peerCount` peers uniformly at random across the whole grid,
 * clusters them on the `peerCount` instances nearest the current local
 * (priority) selection, densely overlapping it on screen. This is the
 * stress-scale version of `demo-peer-selection.ts`'s "Priority stack": does
 * the local selection's `ColoredOutlinePass` ring stay visible when
 * surrounded by dozens/hundreds of simultaneous, tightly-overlapping peer
 * selections, not just a handful spread across the whole scene? See the
 * "Peer Colors" pane folder's own hint row for what to actually compare in
 * the performance HUD while trying this.
 *
 * Auto-picks the grid's center-most instance as the local selection first
 * if nothing is selected yet, so this works immediately on a fresh page
 * load without requiring a manual click first.
 */
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

/**
 * One "heavy 3D model" stand-in geometry, shared by every instance -
 * `MergedSelectionOverlay`/`ColoredOutlinePass` only ever read
 * geometry/transforms to build their own overlay data, never mutate it.
 *
 * Every instance is one `THREE.InstancedMesh` rather than one
 * `THREE.Mesh` each (this file's own pre-instancing history) - collapses
 * what used to be N draw calls for the base grid into 1, regardless of
 * `instanceCount`. Allocated once at `kMaxInstanceCount` capacity;
 * `spawnInstances` below only ever repositions instances `[0, count)` and
 * adjusts `instancedMesh.count`, never reallocates the underlying GPU
 * buffers - resizing the "instances" slider is therefore just a matrix
 * rewrite, not a rebuild.
 */
const heavyGeometry = new THREE.TorusKnotGeometry(0.6, 0.22, 128, 24);
const heavyMaterial = new THREE.MeshStandardMaterial({ color: "#4a90d9" });

const instancedMesh = new THREE.InstancedMesh(heavyGeometry, heavyMaterial, kMaxInstanceCount);
instancedMesh.count = 0;
scene.add(instancedMesh);

let instanceCount = 0;

let selectedInstanceId: number | null = null;
let hoveredInstanceId: number | null = null;
/**
 * "Select N instances at once" bulk stress mechanism, mutually exclusive
 * with `selectedInstanceId` (same invariant this file has always kept
 * between the single click-selection and Random Selection) -
 * `handleClick`/`randomizeSelection` each clear the other's state first.
 */
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

/**
 * Builds a standalone, never-added-to-the-scene `THREE.Mesh` carrying only
 * `instanceId`'s own current world matrix and the shared geometry -
 * `MergedSelectionOverlay` only ever reads a target's `.geometry` and
 * `.matrixWorld` (via `updateWorldMatrix`), never its scene-graph
 * membership, so a detached carrier works as a drop-in `targets` entry in
 * place of a real per-instance `Object3D` (which an `InstancedMesh` doesn't
 * have). `matrixAutoUpdate = false` + writing `.matrix` directly (rather
 * than decomposing into position/quaternion/scale) keeps this exact, and
 * `updateMatrixWorld(true)` bakes `matrixWorld` from that `.matrix`
 * immediately, without waiting for a scene traversal that will never visit
 * an object that was never added to the scene.
 */
function instanceProxyMesh(
  instanceId: number
): THREE.Mesh {
  const mesh = new THREE.Mesh(heavyGeometry);
  mesh.matrixAutoUpdate = false;
  instancedMesh.getMatrixAt(instanceId, mesh.matrix);
  mesh.updateMatrixWorld(true);

  return mesh;
}

/**
 * Rebuilds both overlays (selection: `selectedInstanceId` ∪
 * `randomSelectedInstanceIds`, always at most one of those two non-empty;
 * hover: `hoveredInstanceId`, suppressed while it equals the current
 * selection - same suppression `SelectionManager`'s own hover overlay uses)
 * under whichever `renderMode` is active now, then refreshes Peer Colors so
 * it picks up the same state. Called on every selection/hover/mode/xray
 * change - the single entry point every interaction below funnels through.
 *
 * Exactly one mechanism renders the local selection/hover per mode - see
 * `RenderMode`'s own doc comment: `"outline"` owns `MergedSelectionOverlay`
 * outright, `"peerColors"` relies on `ColoredOutlinePass`'s own `priority`
 * entry for selection and a plain entry for hover (see `refreshPeerColors`)
 * - reliable on its own, so nothing else is needed.
 */
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
        color: selectionManager.hoverColor,
        opacity: selectionManager.hoverOpacity,
        linewidth: selectionManager.outlineOptions.linewidth,
        xray: selectionManager.xray
      });
    }
    if (selectedIds.length > 0) {
      selectionOverlay = new MergedSelectionOverlay({
        parent: scene,
        targets: selectedIds.map(instanceProxyMesh),
        color: selectionManager.color,
        opacity: 1,
        linewidth: selectionManager.outlineOptions.linewidth,
        // Always on, unlike hover above - a real `THREE.LineSegments` with
        // `xray: true` (`depthTest: false` + `renderOrder: 999`, see
        // `SelectionOutline`'s own doc comment) is what makes this mode's
        // selection reliably visible through occluders at all, the local
        // equivalent of `"peerColors"` mode's own `priority` guarantee.
        xray: true
      });
    }
  }
  // "peerColors": the branch above doesn't apply - the local selection/hover
  // render via `refreshPeerColors` below instead.

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

/**
 * Partial Fisher-Yates over `[0, count)`, so repeated calls don't bias
 * toward whichever instance ids happen to be lowest.
 */
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

/**
 * World-space position of instance `index` within a `count`-sized cubic
 * grid - the exact layout `spawnInstances` bakes into `instancedMesh`'s own
 * matrices, extracted so `nearestInstanceIdsToPosition` below can compute
 * distances against it without a per-instance `getMatrixAt`/decompose
 * round-trip (cheap either way at these instance counts, but this avoids
 * two independent copies of the same grid formula drifting apart).
 */
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

/**
 * Repositions instances `[0, count)` into a roughly cubic grid centered on
 * the origin and sets `instancedMesh.count` - never reallocates the
 * underlying GPU buffers, see `instancedMesh`'s own comment. Clears every
 * selection/hover/peer-assignment first so nothing ends up pointing at an
 * instance id that a smaller `count` just repositioned out from under it.
 */
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
    // OrbitControls drag, not a selection click.
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
    }
  });

const selectionFolder = pane.addFolder({ title: "Selection" });

/**
 * Draw-call cost note: `"outline"` mode's `MergedSelectionOverlay` is a
 * single cheap draw call regardless of how many instances are covered, but
 * every rebuild (any selection/hover change) re-merges their geometry from
 * scratch. `"peer colors"` (`ColoredOutlinePass`) doesn't rebuild geometry at
 * all - its mask pass only ever draws the currently outlined instances, so
 * cost scales with selection size, not scene size, and it's the only mode
 * where peers are visible at all (see "mode"'s own description below).
 */
// No field/monitor fits a paragraph (`jolly-monitor`'s value column doesn't
// wrap; `jolly-property-row`'s own `description` does) - built directly and
// appended to `folder.element`, the facade's own documented escape hatch for
// content it has no builder for.
const perfHintRow = document.createElement("jolly-property-row");
perfHintRow.label = "perf note";
perfHintRow.description = "\"outline\" re-merges geometry on every change; \"peer colors\" never rebuilds " +
  "geometry and is the only mode where peers are visible.";
selectionFolder.element.append(perfHintRow);

/**
 * One dropdown for both the local selection *and* peers - see `RenderMode`'s
 * own doc comment for why these were never really independent choices.
 * "outline" is local-only (no peers - not a limitation of this dropdown, but
 * of what a per-object technique can represent on an `InstancedMesh`
 * instance at all); "peer colors" is the one mode where peers - and the
 * local selection, in the same style - both show.
 */
const modeHintRow = document.createElement("jolly-property-row");
modeHintRow.description = "\"outline\" only shows your own local selection - switch to \"peer colors\" to " +
  "see every peer too, in the same ring style.";
selectionFolder.element.append(modeHintRow);

// Explicit annotation: without it, TS narrows this object literal's `mode`
// to the literal `"outline"` (control-flow narrowing a `let` read), which
// the `satisfies Record<string, RenderMode>` binding below would then reject.
const modeSettings: { mode: RenderMode; } = { mode: renderMode };
selectionFolder
  .addBinding(modeSettings, "mode", {
    label: "mode",
    options: {
      outline: "outline",
      "peer colors (postprocess, collaborative)": "peerColors"
    } satisfies Record<string, RenderMode>
  })
  .on("change", ({ value }) => {
    renderMode = value;
    rebuildOverlays();
    updateControlAvailability();
  });

/**
 * Only affects "outline" mode's hover overlay now (a dedicated
 * `MergedSelectionOverlay` - see `rebuildOverlays`) - the local selection is
 * always visible in both modes regardless of this setting (a permanent
 * `xray: true` overlay in "outline", or `ColoredOutlinePass`'s own
 * `priority` guarantee in "peer colors"), and "peer colors" mode has no
 * occlusion concept at all to gate - every entry (selection, hover, and
 * peers alike) always draws at full strength there, see
 * `ColoredOutlinePass`'s own doc comment for why.
 */
const xraySettings = { xray: selectionManager.xray };
const xrayBinding = selectionFolder
  .addBinding(xraySettings, "xray", { label: "x-ray (\"outline\" mode only - hover)" })
  .on("change", ({ value }) => {
    selectionManager.setXray(value);
    rebuildOverlays();
  });

/**
 * Reflects whether x-ray currently does anything, rather than leaving that
 * to label text alone - called once here for the initial state, and again
 * from "mode"'s own handler above whenever it changes.
 */
function updateControlAvailability(): void {
  xrayBinding.disabled = renderMode !== "outline";
}
updateControlAvailability();

const randomFolder = pane.addFolder({ title: "Random Selection" });
const randomSettings = { count: 0 };
randomFolder
  .addBinding(randomSettings, "count", {
    label: "count",
    min: 0,
    max: kMaxInstanceCount,
    step: 1
  })
  // Rebuild only on release, like "instances" above - dragging would
  // otherwise re-pick and rebuild overlays on every intermediate tick.
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

const peerColorsFolder = pane.addFolder({ title: "Peer Colors (ColoredOutlinePass)" });
const peerColorsSettings = { peerCount: 4 };
peerColorsFolder
  .addBinding(peerColorsSettings, "peerCount", {
    label: "peer count",
    min: 0,
    max: kMaxInstanceCount,
    step: 1
  })
  // Rebuild only on release, like "instances"/"count" above.
  .on("change", ({ value, last }) => {
    if (last) {
      randomizePeerColors(Math.round(value));
    }
  });
peerColorsFolder.addButton({ title: "Randomize assignment" }).on("click", () => {
  randomizePeerColors(Math.round(peerColorsSettings.peerCount));
});

const clusterHintRow = document.createElement("jolly-property-row");
clusterHintRow.description = "Packs peers densely around your selection instead of spreading them out - " +
  "stresses ColoredOutlinePass's priority guarantee specifically, not just its per-color cost.";
peerColorsFolder.element.append(clusterHintRow);
peerColorsFolder.addButton({ title: "Cluster around selection" }).on("click", () => {
  clusterPeerColorsAroundSelection(Math.round(peerColorsSettings.peerCount));
});

startLoop({
  renderer,
  scene,
  camera,
  controls,
  // `coloredOutline` owns a full `RenderPipeline`, so it's only used as the
  // frame's render call while "mode" above is "peerColors" - every other
  // frame renders normally.
  render: () => (renderMode === "peerColors" ? coloredOutline.render() : renderer.render(scene, camera)),
  onBeforeRender: () => performanceStats.begin(),
  onAfterRender: () => performanceStats.end()
});
