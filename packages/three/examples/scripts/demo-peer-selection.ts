// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import {
  SelectionManager,
  PeerSelectionRegistry,
  PeerSelectionOverlays,
  PeerColoredOutlinePass,
  PeerSelectionVisibility,
  PeerSelectionChips,
  ColoredOutlinePass,
  type SelectionTechnique
} from "../../src/index.ts";
import {
  createRenderer,
  createScene,
  createOrbitCamera,
  startLoop
} from "./utils/common.ts";
import { createExamplePane } from "./utils/example-switcher.ts";
import { PeerColorPaletteAllocator } from "./network/PeerColorPaletteAllocator.ts";

// CONSTANTS
// Pointer must stay within this many CSS pixels between down/up to count as
// a click rather than an orbit drag.
const kClickDragThresholdPx = 4;

const canvas = document.querySelector("canvas") as HTMLCanvasElement;
const renderer = await createRenderer(canvas);

const scene = createScene("#15151f");
scene.add(new THREE.AmbientLight("#ffffff", 0.7));

const keyLight = new THREE.DirectionalLight("#ffffff", 0.8);
keyLight.position.set(4, 6, 3);
scene.add(keyLight);

// Straight-on view (camera/target share x=0) rather than an angled one, so
// the priority stack's screen-space overlap with "Priority Cone" (see its
// own comment below) comes purely from orbit-radius/z separation, not
// incidental camera skew - easy to reason about, still fully explorable via
// orbit.
const { camera, controls } = createOrbitCamera(
  canvas,
  { x: 0, y: 5, z: 18 },
  { x: 0, y: 1, z: 0 }
);

/**
 * A curated, preset collaborative-selection scenario - unlike
 * `demo-stress.ts` (randomized, perf-focused), every object/peer/selection
 * here is fixed on load specifically so the three behaviors below are
 * visible at a glance, no clicking required first:
 *
 * - Priority stack: three peers (Dax/Eve/Finn), each selecting one of three
 *   small shapes ("Orbiter Box"/"Orbiter Tetra"/"Orbiter Octa") that
 *   continuously orbit "Priority Cone" (the local user's own starting
 *   selection) at different speeds - so which orbiter is nearest the camera,
 *   and how many overlap Cone's silhouette at once, keeps changing on its
 *   own. This demonstrates the local selection staying visually on top of
 *   several simultaneous, moving, overlapping peer selections at once, not
 *   just one (see "Peer rendering" below for how that guarantee differs by
 *   mode, and "Priority stack" below to pause/reshuffle it).
 * - "Shared Sphere": both Alice and Bob select it. The primary ring itself
 *   still only ever shows the primary (oldest) selector's color (Alice's) -
 *   the "single 3D overlay, full detail elsewhere" split `PeerSelectionOverlays`
 *   itself documents - but a small row of colored chips now floats above it
 *   (`PeerSelectionChips`, see below), one per selector, so Bob's presence
 *   is visible in the 3D view too, not just the legend.
 * - "Hidden Torus"/"Hidden Cylinder", both behind "Occluder Wall": peers
 *   Cara/Grace select them respectively. In "colors" Peer rendering mode
 *   both are visible through the wall unconditionally - `ColoredOutlinePass`
 *   has no occlusion concept at all, every ring always draws at full
 *   strength (see its own doc comment for why). In "overlays" mode instead,
 *   x-ray starts on, so both are visible through the wall immediately there
 *   too; toggle "show occluder" to hide/reveal the wall itself - reliable at
 *   any time, unlike the "x-ray" checkbox, which only affects the *local*
 *   selection live - `PeerSelectionOverlays` only reads x-ray fresh when a
 *   peer overlay is built, not retroactively, so toggling it after load
 *   won't change Cara's/Grace's already-built overlays until they
 *   deselect/reselect.
 * - "Free Icosahedron": nothing pre-selects it - click it (or anything else)
 *   to try the local selection/hover experience directly.
 */
function material(
  color: THREE.ColorRepresentation = "#4a90d9"
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color });
}

const selectableMeshes: THREE.Mesh[] = [];
const pickToId = new Map<THREE.Mesh, string>();
const displayNames = new Map<string, string>();

function spawnMesh(
  id: string,
  name: string,
  mesh: THREE.Mesh,
  position: THREE.Vector3Tuple
): THREE.Mesh {
  mesh.name = name;
  mesh.position.set(...position);
  scene.add(mesh);
  selectableMeshes.push(mesh);
  pickToId.set(mesh, id);
  displayNames.set(id, name);

  return mesh;
}

const cone = spawnMesh(
  "cone",
  "Priority Cone",
  new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.7, 8), material("#4ad9c8")),
  [-8.1, 0.7, -1.5]
);
const sphere = spawnMesh(
  "sphere",
  "Shared Sphere",
  new THREE.Mesh(new THREE.SphereGeometry(0.9, 24, 16), material("#d94a90")),
  [-2.5, 1, 0]
);
const torus = spawnMesh(
  "torus",
  "Hidden Torus",
  new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.25, 12, 28), material("#4a90d9")),
  [2.5, 1, 0]
);
const cylinder = spawnMesh(
  "cylinder",
  "Hidden Cylinder",
  new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.3, 16), material("#4a6bd9")),
  [1.6, 1, -0.3]
);
const icosahedron = spawnMesh(
  "icosahedron",
  "Free Icosahedron",
  new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), material("#8a8a9a")),
  [7.5, 1, 0]
);

/**
 * Not in `selectableMeshes`/`pickToId` - purely an occluder, never itself
 * selectable. Sits between the camera and "Hidden Torus"/"Hidden Cylinder"
 * from this scene's default view, toggled via the "show occluder" checkbox
 * below.
 */
const wall = new THREE.Mesh(
  new THREE.BoxGeometry(3.4, 3, 0.3),
  new THREE.MeshStandardMaterial({ color: "#2a2a38" })
);
wall.name = "Occluder Wall";
wall.position.set(2.5, 1.3, 2.5);
scene.add(wall);

/**
 * Three small peer-selected shapes continuously orbiting "Priority Cone" -
 * see this file's own top comment for why (a moving, simultaneous-many-peer
 * stress test, not just a single static overlap). Each orbits at a different
 * (and differently-signed) angular speed so their relative front/behind
 * ordering keeps interleaving rather than staying in lockstep.
 *
 * `applyOrbiterPositions`/`advanceOrbiters` deliberately only ever mutate
 * `mesh.position` - any overlay attached to an orbiter (a `SelectionOutline`
 * child, or `ColoredOutlinePass`'s own per-frame mask re-render) already
 * tracks its target's live transform on its own, so nothing here needs to
 * know an overlay exists, let alone rebuild one.
 */
interface PriorityOrbiter {
  id: string;
  mesh: THREE.Mesh;
  angle: number;
  /** Radians/second - a negative value orbits the opposite direction. */
  speed: number;
}

const priorityOrbitCenter = new THREE.Vector3(-8.1, 1.1, -1.5);
const priorityOrbitRadius = 1.6;

interface SpawnOrbiterOptions {
  id: string;
  name: string;
  geometry: THREE.BufferGeometry;
  color: THREE.ColorRepresentation;
  angle: number;
  speed: number;
}

function spawnOrbiter(
  options: SpawnOrbiterOptions
): PriorityOrbiter {
  const { id, name, geometry, color, angle, speed } = options;
  const mesh = spawnMesh(id, name, new THREE.Mesh(geometry, material(color)), [0, 0, 0]);

  return { id, mesh, angle, speed };
}

const priorityOrbiters: PriorityOrbiter[] = [
  spawnOrbiter({
    id: "orbiterBox",
    name: "Orbiter Box",
    geometry: new THREE.BoxGeometry(0.8, 0.8, 0.8),
    color: "#8c5a6b",
    angle: 0,
    speed: 0.6
  }),
  spawnOrbiter({
    id: "orbiterTetra",
    name: "Orbiter Tetra",
    geometry: new THREE.TetrahedronGeometry(0.75),
    color: "#5a8c7a",
    angle: (Math.PI * 2) / 3,
    speed: -0.45
  }),
  spawnOrbiter({
    id: "orbiterOcta",
    name: "Orbiter Octa",
    geometry: new THREE.OctahedronGeometry(0.75),
    color: "#8c7a5a",
    angle: (Math.PI * 4) / 3,
    speed: 0.8
  })
];

function applyOrbiterPositions(): void {
  for (const orbiter of priorityOrbiters) {
    orbiter.mesh.position.set(
      priorityOrbitCenter.x + (Math.cos(orbiter.angle) * priorityOrbitRadius),
      priorityOrbitCenter.y,
      priorityOrbitCenter.z + (Math.sin(orbiter.angle) * priorityOrbitRadius)
    );
  }
}
applyOrbiterPositions();

const orbitClock = new THREE.Clock();
let orbitEnabled = true;

/**
 * Called once per frame regardless of `orbitEnabled` (see "Priority stack"'s
 * "spin" checkbox below) so `orbitClock.getDelta()` never accumulates a
 * large jump across a pause - only *applying* that delta to the orbiters'
 * angles is gated.
 */
function advanceOrbiters(): void {
  const deltaSeconds = orbitClock.getDelta();
  if (!orbitEnabled) {
    return;
  }

  for (const orbiter of priorityOrbiters) {
    orbiter.angle += orbiter.speed * deltaSeconds;
  }
  applyOrbiterPositions();
}

/**
 * Jumps every orbiter to a new random angle instantly - the "reshuffle now"
 * button's handler, works whether or not `orbitEnabled` is currently on.
 */
function reshuffleOrbiters(): void {
  for (const orbiter of priorityOrbiters) {
    orbiter.angle = Math.random() * Math.PI * 2;
  }
  applyOrbiterPositions();
}

/**
 * The one scene-level postprocess technique `selectionManager`/the "Peer
 * rendering" toggle below drive - see each's own doc comment. Owns a full
 * `RenderPipeline`, so it's only used as the frame's render call while
 * `peerRenderingMode === "colors"` (see the `startLoop` `render` override at
 * the bottom of this file) - `renderer.render(scene, camera)` handles every
 * other frame directly.
 */
const coloredOutline = new ColoredOutlinePass(renderer, scene, camera);

// x-ray defaults on: `PeerSelectionOverlays` only reads `selection.xray`
// fresh when a peer overlay is (re)built (see this file's "Peer rendering"
// doc comment above `setPeerRenderingMode`) - Cara's/Grace's "Hidden
// Torus"/"Hidden Cylinder" overlays are built once, below, from this initial
// value, so starting `xray: false` here would mean toggling the "x-ray"
// checkbox afterward could never retroactively reveal them through
// "Occluder Wall" (only "show occluder" reliably does that, or
// deselecting/reselecting Cara/Grace). `coloredOutline` above needs no
// matching setup - it has no occlusion concept at all, so it shows Cara's/
// Grace's rings through the wall unconditionally, in either mode.
const selectionManager = new SelectionManager({ xray: true });
selectionManager.register("cone", cone);
selectionManager.register("sphere", sphere);
selectionManager.register("torus", torus);
selectionManager.register("cylinder", cylinder);
selectionManager.register("icosahedron", icosahedron);
for (const orbiter of priorityOrbiters) {
  selectionManager.register(orbiter.id, orbiter.mesh);
}

/**
 * Shared across this demo's single `PeerSelectionRegistry`, same injection
 * point `demo-selection.ts` itself demonstrates - see that file's own
 * comment on `PeerColorPaletteAllocator` for why a shared instance matters
 * in a real multi-editor workspace.
 */
const peerRegistry = new PeerSelectionRegistry({
  colorAllocator: new PeerColorPaletteAllocator()
});

/**
 * Frustum + distance gating for peer indicators - see its own doc comment.
 * Shared across both "Peer rendering" mechanisms below (only one is ever
 * actually active at a time, but both accept it identically). Never affects
 * the local user's own selection. `update()` runs once per render tick, from
 * `startLoop`'s `onFrame` at the bottom of this file - orbit the camera away
 * from a peer selection to see its indicator disappear, or lower "max
 * distance" in the "Peer rendering" folder below.
 */
const peerVisibility = new PeerSelectionVisibility({
  registry: peerRegistry,
  selection: selectionManager,
  camera
});

/**
 * A third, independent peer-rendering concern from "Peer rendering" below -
 * a small row of colored billboard chips above any object with *more than
 * one* simultaneous peer selector (see its own doc comment), regardless of
 * which of `PeerSelectionOverlays`/`PeerColoredOutlinePass` is drawing that
 * object's own primary ring, or even whether the local user has it selected
 * too. "Shared Sphere" (Alice + Bob) is the one object in this scene that
 * ever shows a chip row. Shares `peerVisibility` with both peer-rendering
 * mechanisms above, so a culled multi-selection loses its chip row the same
 * way it loses its ring. Unlike those two, this demo never needs to call
 * anything on the instance afterward - entirely event-driven internally, so
 * it's constructed purely for its side effect (subscribing to `peerRegistry`/
 * `peerVisibility`), no binding kept around. `enabled: true` - defaults to
 * `false` (opt-in) on the class itself, but this demo exists specifically to
 * show the feature, so it's turned on from the start here.
 */
new PeerSelectionChips({
  registry: peerRegistry,
  selection: selectionManager,
  visibility: peerVisibility,
  enabled: true
});

/**
 * "Peer rendering" mode - the two peer-layer mechanisms this package ships,
 * mutually exclusive here so the scene stays legible (both would otherwise
 * draw their own ring around the same peer-selected object). Both are given
 * `peerVisibility` (see its own construction/doc comment above) identically,
 * so frustum/max-distance culling applies the same way regardless of which
 * mode is active:
 * - `"overlays"` (`PeerSelectionOverlays`): one disposable
 *   `SelectionOutline`/`SelectionBoundingBox` per peer-selected object,
 *   reusing `selectionManager`'s own `technique`/`xray` - x-ray is a real,
 *   explicit toggle here, same as the local selection's own overlay.
 * - `"colors"` (`PeerColoredOutlinePass` + `ColoredOutlinePass`): one shared
 *   postprocess pass, arbitrary simultaneous colors, every ring always drawn
 *   at full strength regardless of real scene occlusion (see
 *   `ColoredOutlinePass`'s own doc comment for why), and - the reason this
 *   demo's priority stack (Orbiter Box/Tetra/Octa around Priority Cone)
 *   exists - a `priority` entry for the local selection that wins any
 *   on-screen silhouette overlap with a peer's, regardless of actual depth,
 *   even against several overlapping peer selections at once.
 *
 * The "selection technique" dropdown below is kept in sync with this mode
 * *both* ways, not just as a one-time default: `"overlays"` always forces
 * technique back to `"outline"`, `"colors"` always forces it to
 * `"coloredOutline"`. This isn't just tidiness - `PeerSelectionOverlays`
 * never renders the local selection at all (peer-only, by design; see its
 * own doc comment), while `SelectionManager` skips building its own local
 * overlay whenever technique is `"coloredOutline"` (assuming
 * `ColoredOutlinePass` is handling it) - decoupling the two used to mean the
 * *local* selection could render nothing at all, not just a peer falling
 * back to a plain line-segment look.
 */
type PeerRenderingMode = "overlays" | "colors";
let peerSelectionOverlays: PeerSelectionOverlays | null = null;
let peerColoredOutline: PeerColoredOutlinePass | null = null;
let peerRenderingMode: PeerRenderingMode = "overlays";

function setPeerRenderingMode(
  mode: PeerRenderingMode
): void {
  peerRenderingMode = mode;

  peerSelectionOverlays?.dispose();
  peerSelectionOverlays = null;
  peerColoredOutline?.dispose();
  peerColoredOutline = null;
  coloredOutline.setEntries([]);

  if (mode === "overlays") {
    peerSelectionOverlays = new PeerSelectionOverlays({
      registry: peerRegistry, selection: selectionManager, visibility: peerVisibility
    });
  }
  else {
    peerColoredOutline = new PeerColoredOutlinePass({
      registry: peerRegistry, selection: selectionManager, coloredOutline, visibility: peerVisibility
    });
  }
}
setPeerRenderingMode("overlays");

// Preset roster - no live add/remove UI in this demo, unlike
// `demo-selection.ts`'s "Presence" folder; see this file's own top comment
// for why each peer picked the object it did.
peerRegistry.select("Alice", "sphere");
peerRegistry.select("Bob", "sphere");
peerRegistry.select("Cara", "torus");
peerRegistry.select("Grace", "cylinder");
peerRegistry.select("Dax", "orbiterBox");
peerRegistry.select("Eve", "orbiterTetra");
peerRegistry.select("Finn", "orbiterOcta");

selectionManager.select("cone");

const raycaster = new THREE.Raycaster();
const pointerNdc = new THREE.Vector2();

let hovered: THREE.Mesh | null = null;
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

function pickMesh(): THREE.Mesh | null {
  raycaster.setFromCamera(pointerNdc, camera);
  const [hit] = raycaster.intersectObjects(selectableMeshes, false);

  return (hit?.object as THREE.Mesh | undefined) ?? null;
}

function resolvePickId(
  hit: THREE.Mesh
): string {
  const id = pickToId.get(hit);
  if (!id) {
    throw new Error(`No selection id registered for mesh "${hit.name}"`);
  }

  return id;
}

function updateHover(): void {
  const hit = pickMesh();
  hovered = hit;
  selectionManager.hover(hit ? resolvePickId(hit) : null);
  refreshStatus();
}

function handleClick(): void {
  const hit = pickMesh();
  selectionManager.select(hit ? resolvePickId(hit) : null);
}

const pane = createExamplePane({ title: "Peer Selection" });

const infoFolder = pane.addFolder({ title: "Scenario" });
const status = { hovered: "-", selected: "-" };
infoFolder.addMonitor(status, "hovered");
infoFolder.addMonitor(status, "selected");

function refreshStatus(): void {
  status.hovered = hovered?.name ?? "-";
  status.selected = selectionManager.selected ? (displayNames.get(selectionManager.selected) ?? selectionManager.selected) : "-";
  infoFolder.refresh();
}
selectionManager.addEventListener("selectionChange", refreshStatus);
refreshStatus();

const hintRow = document.createElement("jolly-property-row");
hintRow.description = "Preset scenario, no manual setup needed - see this file's own top comment for the full " +
  "rundown. Try \"Priority stack\" below to see your selection win overlaps with peers, and \"show occluder\" " +
  "under \"Peer rendering\" to reveal Hidden Torus/Cylinder behind the wall.";
infoFolder.element.append(hintRow);

/**
 * Static color legend for the seven preset peers - `PeerColorPaletteAllocator`
 * assigns each a color the first time `colorOf` is called for it, which
 * `peerRegistry.select` above already triggered, so reading it back here is
 * safe.
 */
const legendRow = document.createElement("jolly-property-row");
legendRow.label = "peers";
const legendElt = document.createElement("div");
legendElt.className = "peer-legend";
for (const [peerId, objectId] of [
  ["Alice", "sphere"],
  ["Bob", "sphere"],
  ["Cara", "torus"],
  ["Grace", "cylinder"],
  ["Dax", "orbiterBox"],
  ["Eve", "orbiterTetra"],
  ["Finn", "orbiterOcta"]
] as const) {
  const chipElt = document.createElement("span");
  chipElt.className = "peer-legend-chip";

  const dotElt = document.createElement("span");
  dotElt.className = "peer-legend-dot";
  dotElt.style.backgroundColor = peerRegistry.colorOf(peerId);
  chipElt.appendChild(dotElt);
  chipElt.appendChild(document.createTextNode(`${peerId} → ${displayNames.get(objectId)}`));

  legendElt.appendChild(chipElt);
}
legendRow.appendChild(legendElt);
infoFolder.element.append(legendRow);

const selectionFolder = pane.addFolder({ title: "Selection" });

const techniqueSettings = { technique: selectionManager.technique };
selectionFolder
  .addBinding(techniqueSettings, "technique", {
    label: "selection technique",
    options: {
      outline: "outline",
      "colored outline (postprocess)": "coloredOutline"
    } satisfies Record<string, SelectionTechnique>
  })
  .on("change", ({ value }) => {
    selectionManager.setTechnique(value);

    // Keeps "Peer rendering" mode in sync both ways - see this mode's own
    // doc comment for why this is an enforced invariant, not just a default.
    const pairedPeerMode: PeerRenderingMode = value === "coloredOutline" ? "colors" : "overlays";
    if (pairedPeerMode !== peerRenderingMode) {
      setPeerRenderingMode(pairedPeerMode);
      peerModeSettings.mode = pairedPeerMode;
      peerFolder.refresh();
    }
    updateControlAvailability();
  });

const colorSettings = {
  color: `#${new THREE.Color(selectionManager.color).getHexString()}`,
  hoverColor: `#${new THREE.Color(selectionManager.hoverColor).getHexString()}`
};
selectionFolder
  .addBinding(colorSettings, "color", { label: "selected color" })
  .on("change", ({ value }) => selectionManager.setColor(value));
selectionFolder
  .addBinding(colorSettings, "hoverColor", { label: "hover color" })
  .on("change", ({ value }) => selectionManager.setHoverColor(value));

const xraySettings = { xray: selectionManager.xray };
const xrayBinding = selectionFolder
  .addBinding(xraySettings, "xray", {
    label: "x-ray (\"outline\" technique only - local live, peers on next reselect)"
  })
  .on("change", ({ value }) => selectionManager.setXray(value));

const priorityStackFolder = pane.addFolder({ title: "Priority stack" });

const priorityStackHintRow = document.createElement("jolly-property-row");
priorityStackHintRow.description = "Orbiters continuously overlap Priority Cone (your own selection) from " +
  "changing depths - in \"colors\" Peer rendering mode it stays visible regardless; in \"overlays\" it won't.";
priorityStackFolder.element.append(priorityStackHintRow);

const orbitSettings = { spin: orbitEnabled };
priorityStackFolder
  .addBinding(orbitSettings, "spin", { label: "spin" })
  .on("change", ({ value }) => {
    orbitEnabled = value;
  });

priorityStackFolder.addButton({ title: "reshuffle now" }).on("click", () => {
  reshuffleOrbiters();
});

const peerFolder = pane.addFolder({ title: "Peer rendering" });

// Explicit annotation: without it, TS narrows this object literal's `mode`
// to the literal `"overlays"` (control-flow narrowing a `let` read, unlike
// `selectionManager.technique` above which is a getter call), which the
// `satisfies Record<string, PeerRenderingMode>` binding below would then
// reject.
const peerModeSettings: { mode: PeerRenderingMode; } = { mode: peerRenderingMode };
peerFolder
  .addBinding(peerModeSettings, "mode", {
    label: "mode",
    options: {
      "overlays (per-object)": "overlays",
      "colors (postprocess, priority)": "colors"
    } satisfies Record<string, PeerRenderingMode>
  })
  .on("change", ({ value }) => {
    setPeerRenderingMode(value);

    // Keeps "selection technique" in sync both ways - see this mode's own
    // doc comment for why.
    const pairedTechnique: SelectionTechnique = value === "overlays" ? "outline" : "coloredOutline";
    if (pairedTechnique !== selectionManager.technique) {
      selectionManager.setTechnique(pairedTechnique);
      techniqueSettings.technique = pairedTechnique;
      selectionFolder.refresh();
    }
    updateControlAvailability();
  });

const occluderSettings = { visible: wall.visible };
peerFolder
  .addBinding(occluderSettings, "visible", { label: "show occluder" })
  .on("change", ({ value }) => {
    wall.visible = value;
  });

/**
 * Reflects whether x-ray currently does anything, rather than leaving that
 * to label text alone - called once here for the initial state, and again
 * from both the "selection technique" and "Peer rendering" mode handlers
 * above whenever either changes.
 */
function updateControlAvailability(): void {
  xrayBinding.disabled = selectionManager.technique !== "outline";
}
updateControlAvailability();

const visibilityHintRow = document.createElement("jolly-property-row");
visibilityHintRow.description = "\"max distance\" caps how far a peer selection's indicator renders before " +
  "disappearing - never affects your own selection.";
peerFolder.element.append(visibilityHintRow);

const visibilitySettings = { maxDistance: 40 };
peerFolder
  .addBinding(visibilitySettings, "maxDistance", { label: "max distance", min: 0, max: 40, step: 1 })
  .on("change", ({ value }) => {
    peerVisibility.setMaxDistance(value);
  });

startLoop({
  renderer,
  scene,
  camera,
  controls,
  onFrame: () => {
    advanceOrbiters();
    // Camera motion (orbit) is independent of any selection-change event -
    // see `PeerSelectionVisibility`'s own doc comment for why this has to
    // run every frame rather than only reacting to events.
    peerVisibility.update();
  },
  // `coloredOutline` owns a full `RenderPipeline`, so it's only used as the
  // frame's render call while it's actually driving anything (`"colors"`
  // Peer rendering mode) - every other frame renders normally.
  render: () => (peerRenderingMode === "colors" ? coloredOutline.render() : renderer.render(scene, camera))
});
