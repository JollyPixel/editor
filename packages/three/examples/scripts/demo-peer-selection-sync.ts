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
  SelectionSystem,
  PeerSelectionRegistry,
  PeerHoverRegistry,
  type SelectionRenderMode
} from "../../src/index.ts";
import {
  PeerFrustumSync,
  PeerSelectionSync,
  PeerHoverSync
} from "../../src/network/index.ts";
import {
  createRenderer,
  createScene,
  createOrbitCamera,
  startLoop
} from "./utils/common.ts";
import { createExamplePane } from "./utils/example-switcher.ts";
import { bindSelectionAndPeerPanel } from "./utils/selection-panel.ts";
import { mountPerformanceStats } from "./utils/performance-stats.ts";

// CONSTANTS
const kClickDragThresholdPx = 4;
const kRoomId = "three:peer-selection-demo";
const kUsernameStorageKey = "peer-selection-demo:username";
const kUsernameStorage = new LocalStorageAdapter({
  resolve: () => sessionStorage
});
const kModeStorageKey = "peer-selection-demo:mode";
const kKnownTechniques: readonly SelectionRenderMode[] = ["outline", "highlight", "highlightJfa"];
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

const colorPalette = new ColorPalette();

const peerFrustumSync = new PeerFrustumSync({
  room,
  parent: scene,
  color: (clientId) => colorPalette.forKey(clientId)
});
peerFrustumSync.attach(camera);

const peerRegistry = new PeerSelectionRegistry({
  colorAllocator: {
    colorOf: (peerId) => colorPalette.forKey(peerId),
    release: () => void 0
  }
});

const peerHoverRegistry = new PeerHoverRegistry({
  colorAllocator: {
    colorOf: (peerId) => colorPalette.forKey(peerId),
    release: () => void 0
  }
});

const storedTechnique = kModeStorage.get(kModeStorageKey) as SelectionRenderMode | null;
const selection = new SelectionSystem({
  renderer,
  scene,
  camera,
  mode: storedTechnique && kKnownTechniques.includes(storedTechnique) ? storedTechnique : "outline",
  peerSelections: peerRegistry,
  peerHovers: peerHoverRegistry,
  chips: true
});
const selectionManager = selection.manager;
for (const mesh of selectableMeshes) {
  selection.register(pickToId.get(mesh)!, mesh);
}

const peerSelectionSync = new PeerSelectionSync({
  room,
  registry: peerRegistry,
  selection: selectionManager
});

const peerHoverSync = new PeerHoverSync({
  room,
  registry: peerHoverRegistry,
  selection: selectionManager
});

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
  selection.hover(hovered ? resolvePickId(hovered) : null);
  refreshStatus();
}

function handleClick(): void {
  const hit = pickMesh();
  selection.select(hit ? resolvePickId(hit) : null);
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
      color: `#${new THREE.Color(selection.appearance.selected.color).getHexString()}`,
      selectedLabel: selectedLabel(selection.selected)
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
  status.selected = selectedLabel(selection.selected);
  sessionFolder.refresh();
  refreshPeersLegend();
}

selection.addEventListener("selectionChange", refreshStatus);
peerRegistry.addEventListener("peerSelectionChange", refreshPeersLegend);
room.on("sync", refreshPeersLegend);
room.on("peer-joined", refreshPeersLegend);
room.on("peer-left", refreshPeersLegend);
refreshStatus();

bindSelectionAndPeerPanel({
  pane,
  selection,
  maxDistance: { default: 30, max: 30 },
  onModeChange: (mode) => kModeStorage.set(kModeStorageKey, mode)
});

startLoop({
  renderer,
  scene,
  camera,
  controls,
  onFrame: () => {
    peerFrustumSync.update();
    selection.update();
  },
  onBeforeRender: () => performanceStats.begin(),
  onAfterRender: () => performanceStats.end(),
  render: () => selection.render()
});

window.addEventListener("beforeunload", () => {
  peerSelectionSync.destroy();
  peerHoverSync.destroy();
  peerFrustumSync.destroy();
  selection.dispose();
});
