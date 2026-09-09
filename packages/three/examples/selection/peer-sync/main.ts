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
} from "../../../src/index.ts";
import {
  PeerFrustumSync,
  PeerSelectionSync,
  PeerHoverSync
} from "../../../src/network/index.ts";
import {
  createExample,
  orbitCamera
} from "../../shared/example.ts";
import { PEER_SELECTION_ROOM } from "../../shared/rooms.ts";
import { bindSelectionAndPeerPanel } from "../shared/selection-panel.ts";
import { onCanvasPick } from "../shared/pointer-picking.ts";
import {
  Selectables,
  addSelectionLighting,
  selectionMaterial,
  hexOf
} from "../shared/selectables.ts";

// CONSTANTS
const kUsernameStorageKey = "peer-selection-demo:username";
const kUsernameStorage = new LocalStorageAdapter({
  resolve: () => sessionStorage
});
const kModeStorageKey = "peer-selection-demo:mode";
const kKnownTechniques: readonly SelectionRenderMode[] = [
  "outline",
  "highlight",
  "highlightJfa"
];
const kModeStorage = new LocalStorageAdapter({
  resolve: () => sessionStorage
});

const {
  canvas,
  renderer,
  scene,
  camera,
  pane,
  start
} = await createExample({
  title: "Peer Selection (over network)",
  camera: orbitCamera(
    { x: 6, y: 5, z: 8 },
    { x: 0, y: 0.5, z: 0 }
  )
});

addSelectionLighting(scene);

const selectables = new Selectables();

function spawn(
  id: string,
  label: string,
  mesh: THREE.Mesh,
  position: THREE.Vector3Tuple
): void {
  mesh.name = label;
  mesh.position.set(...position);
  scene.add(selectables.add({ id, label, object: mesh }));
}

spawn(
  "box",
  "Box",
  new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.4), selectionMaterial()),
  [-6, 0.7, 0]
);
spawn(
  "cone",
  "Cone",
  new THREE.Mesh(new THREE.ConeGeometry(1, 1.8, 8), selectionMaterial()),
  [-3, 0.9, 0]
);
spawn(
  "icosahedron",
  "Icosahedron",
  new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), selectionMaterial()),
  [0, 1, 0]
);
spawn(
  "sphere",
  "Sphere",
  new THREE.Mesh(
    new THREE.SphereGeometry(0.9, 24, 16),
    selectionMaterial("#d94a90")
  ),
  [3, 1, 0]
);
spawn(
  "torusKnot",
  "Torus Knot",
  new THREE.Mesh(
    new THREE.TorusKnotGeometry(0.8, 0.28, 200, 32),
    selectionMaterial("#4ad991")
  ),
  [6, 1, 0]
);

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
const room = networkClient.room(PEER_SELECTION_ROOM);
room.join();

const colorPalette = new ColorPalette();
const colorAllocator = {
  colorOf: (peerId: string) => colorPalette.forKey(peerId),
  release: () => void 0
};

const peerFrustumSync = new PeerFrustumSync({
  room,
  parent: scene,
  color: (clientId) => colorPalette.forKey(clientId)
});
peerFrustumSync.attach(camera);

const peerRegistry = new PeerSelectionRegistry({ colorAllocator });
const peerHoverRegistry = new PeerHoverRegistry({ colorAllocator });

const storedTechnique = kModeStorage.get(
  kModeStorageKey
) as SelectionRenderMode | null;
const selection = new SelectionSystem({
  renderer,
  scene,
  camera,
  mode: storedTechnique && kKnownTechniques.includes(storedTechnique) ?
    storedTechnique :
    "outline",
  peerSelections: peerRegistry,
  peerHovers: peerHoverRegistry,
  chips: true
});
for (const { id, object } of selectables.items) {
  selection.register(id, object);
}

const peerSelectionSync = new PeerSelectionSync({
  room,
  registry: peerRegistry,
  selection: selection.manager
});

const peerHoverSync = new PeerHoverSync({
  room,
  registry: peerHoverRegistry,
  selection: selection.manager
});

let hoveredId: string | null = null;

onCanvasPick(canvas, {
  camera,
  pick: (raycaster) => selectables.pick(raycaster),
  onHover: (id) => {
    hoveredId = id;
    selection.hover(id);
    refreshStatus();
  },
  onClick: (id) => selection.select(id)
});

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

function refreshPeersLegend(): void {
  const rows: { name: string; color: string; selected: string; }[] = [
    {
      name: `${username} (you)`,
      color: hexOf(selection.appearance.selected.color),
      selected: selectables.labelOf(selection.selected)
    }
  ];

  for (const [clientId, peer] of room.peers) {
    const peerUsername = typeof peer.identity.username === "string" ?
      peer.identity.username :
      "Guest";
    rows.push({
      name: peerUsername,
      color: colorPalette.forKey(clientId),
      selected: selectables.labelOf(peerRegistry.selectionOf(clientId))
    });
  }

  peersListElt.replaceChildren(...rows.map((row) => {
    const chipElt = document.createElement("span");
    chipElt.className = "peer-legend-chip";

    const dotElt = document.createElement("span");
    dotElt.className = "peer-legend-dot";
    dotElt.style.backgroundColor = row.color;
    chipElt.appendChild(dotElt);
    chipElt.appendChild(
      document.createTextNode(`${row.name} → ${row.selected}`)
    );

    return chipElt;
  }));
}

function refreshStatus(): void {
  status.hovered = selectables.labelOf(hoveredId);
  status.selected = selectables.labelOf(selection.selected);
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

start({
  update: () => {
    peerFrustumSync.update();
    selection.update();
  },
  render: () => selection.render()
});

window.addEventListener("beforeunload", () => {
  peerSelectionSync.destroy();
  peerHoverSync.destroy();
  peerFrustumSync.destroy();
  selection.dispose();
});
