// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import {
  SelectionManager,
  PeerSelectionRegistry,
  PeerSelectionOverlays,
  PeerHighlightPass,
  PeerSelectionVisibility,
  PeerSelectionChips,
  HighlightPass,
  HighlightPassJfa
} from "../../src/index.ts";
import {
  createRenderer,
  createScene,
  createOrbitCamera,
  startLoop
} from "./utils/common.ts";
import { createExamplePane } from "./utils/example-switcher.ts";
import { bindSelectionAndPeerPanel, type PeerRenderingMode } from "./utils/selection-panel.ts";
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
 * `selection-stress.ts` (randomized, perf-focused), every object/peer/selection
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
 *   Cara/Grace select them respectively. In either "colors" Peer rendering
 *   mode (blur or JFA) both are visible through the wall unconditionally -
 *   neither `HighlightPass` nor `HighlightPassJfa` has any occlusion concept
 *   at all, every ring always draws at full strength (see each's own doc
 *   comment for why). In "overlays" mode instead, x-ray starts on, so both
 *   are visible through the wall immediately there too; toggle "show
 *   occluder" to hide/reveal the wall itself, or toggle "x-ray" - both apply
 *   live to Cara's/Grace's already-built overlays too, not just the local
 *   selection (see `PeerSelectionOverlays.refreshAll`, wired below).
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
 * child, or `HighlightPass`'s own per-frame mask re-render) already
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
 * The two scene-level postprocess techniques `selectionManager`/the "Peer
 * rendering" toggle below drive - see each's own doc comment. Each owns a
 * full `RenderPipeline`, so only one is ever used as the frame's render call,
 * matching whichever of `peerRenderingMode === "colors"`/`"colorsJfa"` is
 * active (see the `startLoop` `render` override at the bottom of this file) -
 * `renderer.render(scene, camera)` handles every other frame directly.
 */
const highlight = new HighlightPass(renderer, scene, camera);

/**
 * Jump Flood Algorithm alternative to `highlight` above (see
 * `HighlightPassJfa`'s own doc comment) - offered as a third "Peer
 * rendering" mode (`"colorsJfa"`), same as `selection.ts`, so its
 * uniform, resolution-independent ring can be compared against
 * `HighlightPass`'s blur-based one on this file's own preset scenario.
 */
const highlightJfa = new HighlightPassJfa(renderer, scene, camera);

// x-ray defaults on: `PeerSelectionOverlays` only reads `selection.xray`
// fresh when a peer overlay is (re)built (see this file's "Peer rendering"
// doc comment above `setPeerRenderingMode`) - Cara's/Grace's "Hidden
// Torus"/"Hidden Cylinder" overlays are built once, below, from this initial
// value, so starting `xray: false` here would mean toggling the "x-ray"
// checkbox afterward could never retroactively reveal them through
// "Occluder Wall" (only "show occluder" reliably does that, or
// deselecting/reselecting Cara/Grace). `highlight`/`highlightJfa` above need
// no matching setup - neither has any occlusion concept at all, so both show
// Cara's/Grace's rings through the wall unconditionally, in any mode.
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
 * point `selection.ts` itself demonstrates - see that file's own
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
 * which of `PeerSelectionOverlays`/`PeerHighlightPass` is drawing that
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
const peerChips = new PeerSelectionChips({
  registry: peerRegistry,
  selection: selectionManager,
  visibility: peerVisibility,
  enabled: true
});

/**
 * The three peer-layer mechanisms this package ships, mutually exclusive
 * here so the scene stays legible - see `bindSelectionAndPeerPanel`'s own
 * doc comment (utils/selection-panel.ts) for how the panel's single "mode"
 * control drives which one is active. This demo's priority stack (Orbiter
 * Box/Tetra/Octa around Priority Cone) exists specifically to show off
 * "colors"/"colorsJfa"'s `priority` guarantee - see each mechanism's own doc
 * comment for the rest.
 */
let peerSelectionOverlays: PeerSelectionOverlays | null = null;
let peerHighlight: PeerHighlightPass | null = null;
let peerRenderingMode: PeerRenderingMode = "overlays";

function setPeerRenderingMode(
  mode: PeerRenderingMode
): void {
  peerRenderingMode = mode;

  peerSelectionOverlays?.dispose();
  peerSelectionOverlays = null;
  peerHighlight?.dispose();
  peerHighlight = null;
  highlight.setEntries([]);
  highlightJfa.setEntries([]);

  if (mode === "overlays") {
    peerSelectionOverlays = new PeerSelectionOverlays({
      registry: peerRegistry, selection: selectionManager, visibility: peerVisibility
    });
  }
  else {
    peerHighlight = new PeerHighlightPass({
      registry: peerRegistry,
      selection: selectionManager,
      highlight: mode === "colorsJfa" ? highlightJfa : highlight,
      visibility: peerVisibility
    });
  }
}

// Preset roster - no live add/remove UI in this demo, unlike
// `selection.ts`'s "Presence" folder; see this file's own top comment
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

const scenarioFolder = pane.addFolder({ title: "Scenario" });

// Folder-general context, not tied to a specific control, so it leads
// before the live status monitors below it.
const hintRow = document.createElement("jolly-property-row");
hintRow.description = "Preset scenario - see this file's own top comment for the full rundown.";
scenarioFolder.element.append(hintRow);

const status = { hovered: "-", selected: "-" };
scenarioFolder.addMonitor(status, "hovered");
scenarioFolder.addMonitor(status, "selected");

function refreshStatus(): void {
  status.hovered = hovered?.name ?? "-";
  status.selected = selectionManager.selected ? (displayNames.get(selectionManager.selected) ?? selectionManager.selected) : "-";
  scenarioFolder.refresh();
}
selectionManager.addEventListener("selectionChange", refreshStatus);
refreshStatus();

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
scenarioFolder.element.append(legendRow);

const priorityStackFolder = pane.addFolder({ title: "Priority stack" });

const priorityStackHintRow = document.createElement("jolly-property-row");
priorityStackHintRow.description = "Orbiters keep overlapping Priority Cone - stays visible through them in " +
  "either \"colors\" mode below, not in \"overlays\".";
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

// No group in this scene (unlike `selection.ts`'s "Cluster"), so
// `boundingBox` stays omitted - "group opacity" would have nothing to affect
// here.
bindSelectionAndPeerPanel({
  pane,
  selectionManager,
  peerVisibility,
  highlight,
  highlightJfa,
  peerChips,
  maxDistance: { default: 40, max: 40 },
  onPeerModeChange: setPeerRenderingMode,
  // Cara's/Grace's already-built peer overlays otherwise only pick up a
  // fresh x-ray value on their next (de)select - see `refreshAll`'s own doc
  // comment.
  onXrayChange: () => peerSelectionOverlays?.refreshAll(),
  extraPeerBindings: (peerFolder) => {
    const occluderSettings = { visible: wall.visible };
    peerFolder
      .addBinding(occluderSettings, "visible", { label: "show occluder" })
      .on("change", ({ value }) => {
        wall.visible = value;
      });
  }
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
  // `highlight`/`highlightJfa` each own a full `RenderPipeline`, so only one
  // is ever used as the frame's render call, matching "Peer rendering" mode
  // above - every other frame renders normally.
  render: () => {
    if (peerRenderingMode === "colors") {
      highlight.render();
    }
    else if (peerRenderingMode === "colorsJfa") {
      highlightJfa.render();
    }
    else {
      renderer.render(scene, camera);
    }
  }
});
