// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import * as network from "@jolly-pixel/network/client";
import { ColorPalette } from "@jolly-pixel/color";
import {
  LocalStorageAdapter,
  resolveStoredPrompt
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  SelectionManager,
  PeerSelectionRegistry,
  PeerSelectionOverlays,
  PeerHoverRegistry,
  PeerHoverOverlays,
  PeerHighlightPass,
  PeerSelectionVisibility,
  PeerSelectionChips,
  HighlightPass,
  HighlightPassJfa,
  type SelectionTechnique
} from "../../src/index.ts";
import { PeerFrustumSync, PeerSelectionSync, PeerHoverSync } from "../../src/network/index.ts";
import {
  createRenderer,
  createScene,
  createOrbitCamera,
  startLoop
} from "./utils/common.ts";
import { createExamplePane } from "./utils/example-switcher.ts";
import { bindSelectionAndPeerPanel, type PeerRenderingMode } from "./utils/selection-panel.ts";
import { mountPerformanceStats } from "./utils/performance-stats.ts";

// CONSTANTS
// Pointer must stay within this many CSS pixels between down/up to count as
// a click rather than an orbit drag.
const kClickDragThresholdPx = 4;
const kRoomId = "three:peer-selection-demo";
const kUsernameStorageKey = "peer-selection-demo:username";
const kUsernameStorage = new LocalStorageAdapter({
  resolve: () => sessionStorage
});
const kModeStorageKey = "peer-selection-demo:mode";
const kKnownTechniques: readonly SelectionTechnique[] = ["outline", "highlight", "highlightJfa"];
// Same per-tab storage mechanism as the username, under its own key - each
// tab/peer keeps its own "Peer rendering" choice across a refresh, the way
// it already keeps its own username. A fresh reload otherwise silently
// resets `SelectionManager`'s technique to its own default ("outline"),
// which reads as "I lost my JFA selection" even though nothing about the
// peer data itself was lost - see this file's own `setPeerRenderingMode`.
const kModeStorage = new LocalStorageAdapter({
  resolve: () => sessionStorage
});

const canvas = document.querySelector("canvas") as HTMLCanvasElement;
const renderer = await createRenderer(canvas);

const scene = createScene("#1a1a2e");
scene.add(new THREE.AmbientLight("#ffffff", 0.7));

const keyLight = new THREE.DirectionalLight("#ffffff", 0.8);
keyLight.position.set(4, 6, 3);
scene.add(keyLight);

const { camera, controls } = createOrbitCamera(
  canvas,
  { x: 6, y: 5, z: 8 },
  { x: 0, y: 0.5, z: 0 }
);

function material(
  color: THREE.ColorRepresentation = "#4a90d9"
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color });
}

/**
 * A fixed, identical scene on every tab: every client registers the same id
 * for the same object, which is what lets a remote peer's published
 * selection id resolve to something here at all - see PeerSelectionSync's
 * own doc comment on why that's a demo simplification this class itself
 * does not solve (a dynamically built scene needs its own stable,
 * content-addressed id scheme).
 */
const selectableMeshes: THREE.Mesh[] = [];
const pickToId = new Map<THREE.Mesh, string>();
const displayNames = new Map<string, string>();

function spawn(
  id: string,
  name: string,
  mesh: THREE.Mesh,
  position: THREE.Vector3Tuple
): void {
  mesh.name = name;
  mesh.position.set(...position);
  scene.add(mesh);
  selectableMeshes.push(mesh);
  pickToId.set(mesh, id);
  displayNames.set(id, name);
}

spawn("box", "Box", new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.4), material()), [-6, 0.7, 0]);
spawn("cone", "Cone", new THREE.Mesh(new THREE.ConeGeometry(1, 1.8, 8), material()), [-3, 0.9, 0]);
spawn("icosahedron", "Icosahedron", new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), material()), [0, 1, 0]);
spawn("sphere", "Sphere", new THREE.Mesh(new THREE.SphereGeometry(0.9, 24, 16), material("#d94a90")), [3, 1, 0]);
spawn(
  "torusKnot",
  "Torus Knot",
  new THREE.Mesh(new THREE.TorusKnotGeometry(0.8, 0.28, 200, 32), material("#4ad991")),
  [6, 1, 0]
);

/**
 * Scene-level postprocess techniques, same role as in `selection.ts`/
 * `selection-peer.ts` - see `HighlightPass`'s own doc comment. Driven via
 * `render:` in `startLoop` below only while "Peer rendering" is on
 * "colors"/"colorsJfa".
 */
const highlight = new HighlightPass(renderer, scene, camera);
const highlightJfa = new HighlightPassJfa(renderer, scene, camera);

const storedTechnique = kModeStorage.get(kModeStorageKey) as SelectionTechnique | null;
const selectionManager = new SelectionManager({
  technique: storedTechnique && kKnownTechniques.includes(storedTechnique) ? storedTechnique : "outline"
});
for (const mesh of selectableMeshes) {
  selectionManager.register(pickToId.get(mesh)!, mesh);
}

const pane = createExamplePane({ title: "Peer Selection (over network)" });
const performanceStats = mountPerformanceStats(renderer);
const username = await resolveStoredPrompt({
  title: "Join peer selection session",
  label: "Username",
  confirmLabel: "Join",
  storage: kUsernameStorage,
  storageKey: kUsernameStorageKey,
  fallbackValue: "Guest"
});

const networkClient = new network.Client({
  identity: {
    username
  }
});
const room = networkClient.room(kRoomId);
room.join();

/**
 * One shared palette so a peer's camera frustum and selection ring/chips
 * read in the exact same color everywhere. `PeerFrustumSync` and
 * `PeerSelectionRegistry` each resolve peer color independently otherwise -
 * both keyed purely by `clientId`, so sharing one `ColorPalette.forKey` call
 * between them is enough to keep a given peer's color consistent across
 * both mechanisms, with no identity-stamping trick needed (unlike
 * `demo-peer-frustum-sync.ts`'s own `kLocalPeerId`, which only exists there
 * to let that demo preview the *local* tab's own eventual color before the
 * server assigns it - a self-preview problem this demo does not have, since
 * the local user's own selection is never rendered through
 * `PeerSelectionRegistry` at all).
 */
const colorPalette = new ColorPalette();

// Broadcasts this tab's camera as its "player" pose, and renders every
// other peer's camera as a `PeerFrustum` - unrelated to selection, reused
// as-is from `demo-peer-frustum-sync.ts` so a peer's viewpoint is visible
// alongside what they have selected.
const peerFrustumSync = new PeerFrustumSync({
  room,
  parent: scene,
  getColor: (clientId) => colorPalette.forKey(clientId)
});
peerFrustumSync.attach(camera);

const peerRegistry = new PeerSelectionRegistry({
  colorAllocator: {
    colorOf: (peerId) => colorPalette.forKey(peerId),
    release: () => void 0
  }
});

/**
 * Same `colorPalette` as `peerRegistry` above, so a peer's hover ring reads
 * in the exact same color as their selection ring and frustum - see
 * `peerRegistry`'s own comment for why sharing one `ColorPalette.forKey`
 * call is enough.
 */
const peerHoverRegistry = new PeerHoverRegistry({
  colorAllocator: {
    colorOf: (peerId) => colorPalette.forKey(peerId),
    release: () => void 0
  }
});

/**
 * Frustum + distance gating for peer indicators - see its own doc comment.
 * `update()` runs once per render tick, from `startLoop`'s `onFrame` below.
 * Also covers peer-hovered-only objects via `hoverRegistry`, so a hover
 * indicator gets the same culling a peer selection already does.
 */
const peerVisibility = new PeerSelectionVisibility({
  registry: peerRegistry,
  selection: selectionManager,
  camera,
  hoverRegistry: peerHoverRegistry
});

/**
 * Real simultaneous multi-select, unlike `selection-peer.ts`'s scripted
 * preset: two actual browser tabs clicking the same mesh both land in
 * `peerRegistry.selectorsOf` here, and this shows every one of them as a
 * small billboard chip above it, not just the primary ring's color.
 */
const peerChips = new PeerSelectionChips({
  registry: peerRegistry,
  selection: selectionManager,
  visibility: peerVisibility,
  enabled: true
});

/**
 * The network glue: publishes `selectionManager.selected` to `room` and
 * applies every remote peer's published id into `peerRegistry`. Everything
 * else in this file downstream of `peerRegistry` is the exact same
 * transport-agnostic rendering code `selection-peer.ts` drives from a
 * scripted preset instead.
 */
const peerSelectionSync = new PeerSelectionSync({
  room,
  registry: peerRegistry,
  selection: selectionManager
});

/**
 * Same network glue as `peerSelectionSync`, for hover instead of selection -
 * everything downstream of `peerHoverRegistry` (`PeerHoverOverlays`,
 * `PeerHighlightPass`'s own `hoverRegistry` option) is transport-agnostic,
 * same split `PeerSelectionSync`'s own doc comment describes for itself.
 */
const peerHoverSync = new PeerHoverSync({
  room,
  registry: peerHoverRegistry,
  selection: selectionManager
});

let peerSelectionOverlays: PeerSelectionOverlays | null = null;
let peerHoverOverlays: PeerHoverOverlays | null = null;
let peerHighlight: PeerHighlightPass | null = null;
let peerRenderingMode: PeerRenderingMode = "overlays";

function setPeerRenderingMode(
  mode: PeerRenderingMode
): void {
  peerRenderingMode = mode;
  // Persists the technique this mode was derived from (not `mode` itself -
  // `selectionManager.technique` is the actual source of truth restored on
  // the next load, see this file's own `storedTechnique`), so a refresh
  // keeps whatever "Peer rendering" choice was active instead of silently
  // resetting to `SelectionManager`'s own "outline" default.
  kModeStorage.set(kModeStorageKey, selectionManager.technique);

  peerSelectionOverlays?.dispose();
  peerSelectionOverlays = null;
  peerHoverOverlays?.dispose();
  peerHoverOverlays = null;
  peerHighlight?.dispose();
  peerHighlight = null;
  highlight.setEntries([]);
  highlightJfa.setEntries([]);

  if (mode === "overlays") {
    peerSelectionOverlays = new PeerSelectionOverlays({
      registry: peerRegistry, selection: selectionManager, visibility: peerVisibility
    });
    peerHoverOverlays = new PeerHoverOverlays({
      selectionRegistry: peerRegistry,
      hoverRegistry: peerHoverRegistry,
      selection: selectionManager,
      visibility: peerVisibility
    });
  }
  else {
    peerHighlight = new PeerHighlightPass({
      registry: peerRegistry,
      selection: selectionManager,
      highlight: mode === "colorsJfa" ? highlightJfa : highlight,
      visibility: peerVisibility,
      hoverRegistry: peerHoverRegistry
    });
  }
}

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
  hovered = pickMesh();
  selectionManager.hover(hovered ? resolvePickId(hovered) : null);
  refreshStatus();
}

function handleClick(): void {
  const hit = pickMesh();
  // refreshStatus()/refreshPeersLegend() run from the manager's own
  // "selectionChange" listener below, which also publishes to the room via
  // `peerSelectionSync` - no need to call them here too.
  selectionManager.select(hit ? resolvePickId(hit) : null);
}

const sessionFolder = pane.addFolder({ title: "Session" });
const status = {
  you: username,
  hovered: "-",
  selected: "-",
  controls: "click to select/orbit, click a shape to select it"
};
sessionFolder.addMonitors(status, {
  controls: { label: "controls" }
});
sessionFolder.addMonitor(status, "hovered");
sessionFolder.addMonitor(status, "selected");

sessionFolder.addButton({ title: "Change name" }).on("click", () => {
  sessionStorage.removeItem(kUsernameStorageKey);
  window.location.reload();
});

/**
 * Live "who selected what" legend - the dynamic, real-network counterpart to
 * `selection-peer.ts`'s static preset legend: rebuilt from `room.peers`/
 * `peerRegistry` on every roster or selection change instead of hardcoded.
 * The local row's color reads `selectionManager.color` (what actually draws
 * in the 3D view for your own selection) rather than a peer color - the
 * local user's own selection is never entered into `peerRegistry`, so a
 * `colorPalette`-derived swatch here would show a color nothing in the scene
 * actually uses.
 */
const peersFolder = pane.addFolder({ title: "Peers" });
const peersRow = document.createElement("jolly-property-row");
peersRow.label = "selecting";
const peersListElt = document.createElement("div");
peersListElt.className = "peer-legend";
peersRow.appendChild(peersListElt);
peersFolder.element.append(peersRow);

function selectedLabel(
  objectId: string | null
): string {
  return objectId ? (displayNames.get(objectId) ?? objectId) : "-";
}

function refreshPeersLegend(): void {
  const rows: { name: string; color: string; selectedLabel: string; }[] = [
    {
      name: `${username} (you)`,
      color: `#${new THREE.Color(selectionManager.color).getHexString()}`,
      selectedLabel: selectedLabel(selectionManager.selected)
    }
  ];

  for (const [clientId, peer] of room.peers) {
    const peerUsername = typeof peer.identity.username === "string" ? peer.identity.username : "Guest";
    rows.push({
      name: peerUsername,
      color: colorPalette.forKey(clientId),
      selectedLabel: selectedLabel(peerRegistry.selectionOf(clientId))
    });
  }

  peersListElt.replaceChildren(...rows.map((row) => {
    const chipElt = document.createElement("span");
    chipElt.className = "peer-legend-chip";

    const dotElt = document.createElement("span");
    dotElt.className = "peer-legend-dot";
    dotElt.style.backgroundColor = row.color;
    chipElt.appendChild(dotElt);
    chipElt.appendChild(document.createTextNode(`${row.name} → ${row.selectedLabel}`));

    return chipElt;
  }));
}

function refreshStatus(): void {
  status.hovered = hovered?.name ?? "-";
  status.selected = selectedLabel(selectionManager.selected);
  sessionFolder.refresh();
  refreshPeersLegend();
}

selectionManager.addEventListener("selectionChange", refreshStatus);
peerRegistry.addEventListener("peerSelectionChange", refreshPeersLegend);
room.on("sync", refreshPeersLegend);
room.on("peer-joined", refreshPeersLegend);
room.on("peer-left", refreshPeersLegend);
refreshStatus();

bindSelectionAndPeerPanel({
  pane,
  selectionManager,
  peerVisibility,
  highlight,
  highlightJfa,
  peerChips,
  maxDistance: { default: 30, max: 30 },
  onPeerModeChange: setPeerRenderingMode,
  // `PeerSelectionOverlays#refresh` only re-applies x-ray to an existing
  // overlay when something else triggers a refresh - `setXray` itself
  // dispatches no event, so an already peer-selected object needs this
  // explicit nudge. See `PeerSelectionOverlays.refreshAll`'s own doc comment.
  // `PeerHoverOverlays.refreshAll` has the same need, for the same reason.
  onXrayChange: () => {
    peerSelectionOverlays?.refreshAll();
    peerHoverOverlays?.refreshAll();
  }
});

startLoop({
  renderer,
  scene,
  camera,
  controls,
  onFrame: () => {
    peerFrustumSync.update();
    // Camera motion (orbit) is independent of any selection-change event -
    // see `PeerSelectionVisibility`'s own doc comment for why this has to
    // run every frame rather than only reacting to events.
    peerVisibility.update();
  },
  onBeforeRender: () => performanceStats.begin(),
  onAfterRender: () => performanceStats.end(),
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

window.addEventListener("beforeunload", () => {
  peerSelectionSync.destroy();
  peerHoverSync.destroy();
  peerFrustumSync.destroy();
});
