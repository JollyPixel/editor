// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import {
  SelectionManager,
  ToonOutlinePass,
  ColoredOutlinePass,
  PeerSelectionRegistry,
  MergedSelectionOverlay,
  type MeshSelectionStyle,
  type ColoredOutlineEntry
} from "../../src/index.ts";
import { PerformancePanel } from "./components/PerformancePanel.ts";
import {
  createRenderer,
  createScene,
  createOrbitCamera,
  startLoop
} from "./utils/common.ts";
import { createExamplePane } from "./utils/example-switcher.ts";

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
 * meshStyle/outlineOptions/highlightOptions, all already wired to the
 * "Selection" pane folder below) - never `register`/`select`/`hover`.
 * Unlike `demo-selection.ts`, the grid below is one `THREE.InstancedMesh`
 * (see its own comment), which has no per-instance `Object3D` to register:
 * `SelectionManager`'s id-based model fundamentally assumes one scene object
 * per selectable thing, so this demo drives `toonOutline`/the overlay
 * classes directly for every interaction (click-select, hover, Random
 * Selection alike) instead - the same "bypass" shape Random Selection
 * already used even before this file's InstancedMesh conversion, now used
 * for the single click-select and hover too.
 */
const toonOutline = new ToonOutlinePass(renderer, scene, camera);
const selectionManager = new SelectionManager();

/**
 * A third, fully independent whole-frame technique alongside `toonOutline` -
 * owns its own `RenderPipeline`, so (per `ColoredOutlinePass`'s own doc
 * comment) it can't run in the same frame as `toonOutline`; `peerColorsEnabled`
 * below picks which of the two `render()` calls drives the loop.
 */
const coloredOutline = new ColoredOutlinePass(renderer, scene, camera);
const peerRegistry = new PeerSelectionRegistry();
let peerColorsEnabled = false;
let activePeerNames: string[] = [];

/**
 * Replaces `PeerColoredOutline` for this demo rather than using it directly
 * (unlike an earlier version of this file) - `PeerColoredOutline` resolves
 * every id through `SelectionManager.targetFor`, which only ever returns a
 * whole `SelectableObject`, never "one instance of an `InstancedMesh`" (see
 * `ColoredOutlineEntry.instanceId`'s own doc comment for why that's a
 * distinct concept `ColoredOutlinePass` itself only recently grew - a
 * whole-object entry model has no seam for it). This grid has no
 * whole-object selectable things left to hand it, so this function takes
 * over `PeerColoredOutline`'s exact job (local selection wins and is
 * `priority`, peers read in their primary selector's color) directly against
 * instance ids instead - `peerRegistry` itself is unaffected (purely
 * id-based bookkeeping, agnostic to what an id refers to, same as always).
 */
function refreshPeerColors(): void {
  const localIds = selectedInstanceId === null ? randomSelectedInstanceIds : [selectedInstanceId];
  const localIdSet = new Set(localIds);

  const entries: ColoredOutlineEntry[] = localIds.map((instanceId) => {
    return { target: instancedMesh, instanceId, color: selectionManager.color, priority: true };
  });

  for (const objectId of peerRegistry.selectedObjectIds()) {
    const instanceId = Number(objectId);
    if (localIdSet.has(instanceId)) {
      // "My own selection wins visually for myself" - same rule
      // `PeerColoredOutline` itself documents.
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
 * One "heavy 3D model" stand-in geometry, shared by every instance -
 * `MergedSelectionOverlay`/`InstancedOutlineNode`/`ColoredOutlinePass` only
 * ever read geometry/transforms to build their own overlay data, never
 * mutate it.
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
 * under whichever mesh style/xray is active now, then refreshes Peer Colors
 * so it picks up the same state. Called on every selection/hover/style/xray
 * change - the single entry point every interaction below funnels through.
 *
 * "priority" (see `ColoredOutlineEntry.priority`'s own doc comment, mirrored
 * here for the local click-selection) means "this always wins,
 * unconditionally" - see the guaranteed overlay built near the end of this
 * function for why that needs a dedicated, always-built `xray` overlay
 * rather than trusting the mesh style's own selected look (`toonOutline`'s
 * glow, or a depth-tested `MergedSelectionOverlay`) or `ColoredOutlinePass`'s
 * own `priority` handling to provide that guarantee by themselves.
 */
function rebuildOverlays(): void {
  clearSelectionOverlay();
  clearHoverOverlay();

  const style = selectionManager.meshStyle;
  const selectedIds = selectedInstanceId === null ? randomSelectedInstanceIds : [selectedInstanceId];
  const hoverSuppressed = hoveredInstanceId !== null && hoveredInstanceId === selectedInstanceId;
  const hoverIds = !hoverSuppressed && hoveredInstanceId !== null ? [hoveredInstanceId] : [];

  if (style === "toonOutline") {
    toonOutline.setSelectedMany(selectedIds.map((instanceId) => {
      return { mesh: instancedMesh, instanceId };
    }));
    toonOutline.setHovered(hoverIds.length > 0 ? { mesh: instancedMesh, instanceId: hoverIds[0] } : null);
    // `ToonOutlinePass.setXray` is one shared flag for both the selected and
    // hover role (no per-role xray in its API) - `true` here guarantees the
    // selection stays visible as priority whenever this pipeline is the one
    // actually driving the frame (see the guaranteed overlay below for when
    // it isn't); the tradeoff is hover follows it too instead of the
    // "x-ray" checkbox, unlike the outline/highlight styles' own hover
    // overlay below, which stays independent.
    toonOutline.setXray(true);
  }
  else {
    toonOutline.setSelectedMany([]);
    toonOutline.setHovered(null);

    if (hoverIds.length > 0) {
      hoverOverlay = new MergedSelectionOverlay({
        parent: scene,
        style,
        targets: hoverIds.map(instanceProxyMesh),
        color: selectionManager.hoverColor,
        opacity: selectionManager.hoverOpacity,
        linewidth: selectionManager.outlineOptions.linewidth,
        thickness: selectionManager.highlightOptions.thickness,
        xray: selectionManager.xray
      });
    }
  }

  // Guaranteed-visible representation of the local (priority) selection -
  // built unconditionally, regardless of mesh style or whether Peer Colors
  // is driving the frame. Neither of the other two mechanisms fully
  // guarantees this on their own:
  // - `ToonOutlinePass`'s own "selected" glow (above) only ever renders when
  //   *its* pipeline is the one actually driving the frame - Peer Colors
  //   drives `coloredOutline.render()` instead (see the render loop below),
  //   which never touches `toonOutline` at all, so that glow simply doesn't
  //   exist in the composited frame while Peer Colors is on.
  // - `ColoredOutlinePass`'s own `priority` (see `refreshPeerColors`) wins
  //   the underlying per-pixel mask unconditionally, but the *edge color* is
  //   computed from a downsampled, Gaussian-blurred copy of that mask (see
  //   `ColoredOutlinePass`'s own doc comment on the boundary-blend
  //   approximation) - when the priority silhouette sits very close to a
  //   non-priority one on screen, that blur can thin the priority-exclusive
  //   sliver down to nothing, letting the peer's wider color visually win
  //   despite correctly losing the mask itself.
  // A real `THREE.LineSegments`/`Mesh` with `xray: true` sidesteps both:
  // `depthTest: false` + `renderOrder: 999` (see `SelectionOutline`'s own
  // doc comment) draws it after and through everything else in the normal
  // `pass(scene, camera)` term both `toonOutline` and `coloredOutline`
  // composite on top of, independent of either pipeline's own logic.
  // `MergedSelectionOverlay` only supports `"outline"`/`"highlight"`, so
  // `"toonOutline"` falls back to `"outline"` here specifically for this
  // safety net - the toon glow above still gives the actual "toonOutline"
  // look whenever its own pipeline is the one rendering.
  if (selectedIds.length > 0) {
    selectionOverlay = new MergedSelectionOverlay({
      parent: scene,
      style: style === "toonOutline" ? "outline" : style,
      targets: selectedIds.map(instanceProxyMesh),
      color: selectionManager.color,
      opacity: 1,
      linewidth: selectionManager.outlineOptions.linewidth,
      thickness: selectionManager.highlightOptions.thickness,
      xray: true
    });
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
  toonOutline.setSelectedMany([]);
  toonOutline.setHovered(null);
  clearPeerColors();

  const side = Math.ceil(Math.cbrt(count));
  const centerOffset = ((side - 1) * kInstanceSpacing) / 2;
  const matrix = new THREE.Matrix4();

  for (let i = 0; i < count; i++) {
    const x = i % side;
    const y = Math.floor(i / side) % side;
    const z = Math.floor(i / (side * side));

    matrix.setPosition(
      x * kInstanceSpacing - centerOffset,
      y * kInstanceSpacing - centerOffset,
      z * kInstanceSpacing - centerOffset
    );
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
const performancePanel = new PerformancePanel({ pane, renderer, title: "Performance" });

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
 * Draw-call cost warning: `toonOutline` runs on `ToonOutlinePass`, which owns
 * two `InstancedOutlineNode`s (selected + hovered) - see
 * `InstancedOutlineNode.updateBefore`. Whenever either has at least one
 * target, it redraws the *entire non-selected scene* into a depth buffer that
 * frame just to resolve occlusion - one extra full-scene draw-call pass per
 * active role, on top of the normal color pass. At thousands of instances
 * that's the dominant cost, not the instance count itself.
 *
 * `ColoredOutlinePass` (the "Peer Colors" pipeline below) was built
 * specifically to avoid this - see its own doc comment ("N colors would mean
 * paying that cost N times") - its mask pass only ever draws the currently
 * outlined instances, so cost scales with selection size, not scene size.
 * At high instance counts the actionable move is picking the pipeline:
 * prefer Peer Colors (enable it below) over "toon outline (postprocess)".
 */
// No field/monitor fits a paragraph (`jolly-monitor`'s value column doesn't
// wrap; `jolly-property-row`'s own `description` does) - built directly and
// appended to `folder.element`, the facade's own documented escape hatch for
// content it has no builder for.
const perfHintRow = document.createElement("jolly-property-row");
perfHintRow.label = "perf note";
perfHintRow.description = "toon outline (postprocess) redraws the whole non-selected scene into a depth buffer every " +
  "frame something is selected/hovered - twice, once per role - on top of the normal render. " +
  "Peer Colors below (ColoredOutlinePass) doesn't: its cost scales with how many instances are " +
  "outlined, not total instance count. At high instance counts, prefer Peer Colors (enable it " +
  "below) over toon outline.";
selectionFolder.element.append(perfHintRow);

const styleSettings = { meshStyle: selectionManager.meshStyle };
selectionFolder
  .addBinding(styleSettings, "meshStyle", {
    label: "mesh style",
    options: {
      outline: "outline",
      highlight: "highlight",
      "toon outline (postprocess)": "toonOutline"
    } satisfies Record<string, MeshSelectionStyle>
  })
  .on("change", ({ value }) => {
    selectionManager.setMeshStyle(value);
    rebuildOverlays();
  });

// Only affects the *hover* overlay - the selection overlay is always
// x-ray (see rebuildOverlays's own doc comment for why "priority" implies
// that), so this checkbox has nothing left to toggle for it.
const xraySettings = { xray: selectionManager.xray };
selectionFolder
  .addBinding(xraySettings, "xray", { label: "hover x-ray (selection is always visible)" })
  .on("change", ({ value }) => {
    selectionManager.setXray(value);
    rebuildOverlays();
  });

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
const peerColorsSettings = { peerCount: 4, enabled: false };
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
peerColorsFolder
  .addBinding(peerColorsSettings, "enabled", { label: "enabled (drives the frame) - your own click-selection shows too" })
  .on("change", ({ value }) => {
    peerColorsEnabled = value;
  });

startLoop({
  renderer,
  scene,
  camera,
  controls,
  // `coloredOutline` and `toonOutline` each own a full `RenderPipeline` (see
  // `ColoredOutlinePass`'s own doc comment for why that means only one can
  // drive a given frame) - `peerColorsEnabled` picks which. Safe to always
  // route through `toonOutline` otherwise, see its own comment above for why
  // that composites down to the normal scene render when nothing is
  // currently using the "toonOutline" style.
  render: () => (peerColorsEnabled ? coloredOutline.render() : toonOutline.render()),
  onAfterRender: () => performancePanel.update()
});
