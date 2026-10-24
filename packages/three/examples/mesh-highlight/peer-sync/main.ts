// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import * as network from "@jolly-pixel/network/client";
import { ColorSequence } from "@jolly-pixel/color";
import { LocalStorageAdapter } from "@jolly-pixel/ui";
import { resolveStoredPrompt } from "@jolly-pixel/ui/elements/dialog";

// Import Internal Dependencies
import {
  MeshHighlight,
  PeerHighlights,
  type MeshHighlightMode
} from "../../../src/index.ts";
import {
  PeerFrustumSync,
  PeerHighlightSync
} from "../../../src/network/index.ts";
import {
  createExample,
  orbitCamera
} from "../../shared/example.ts";
import { PEER_SELECTION_ROOM } from "../../shared/rooms.ts";
import { bindHighlightAndPeerPanel } from "../shared/highlight-panel.ts";
import { onCanvasPick } from "../shared/pointer-picking.ts";
import {
  Selectables,
  addSelectionLighting,
  selectionMaterial,
  toHex
} from "../shared/selectables.ts";

// CONSTANTS
const kUsernameStorageKey = "peer-selection-demo:username";
const kUsernameStorage = new LocalStorageAdapter({
  resolve: () => sessionStorage
});
const kModeStorageKey = "peer-selection-demo:mode";
const kKnownTechniques: readonly MeshHighlightMode[] = [
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
  profile: {
    username
  }
});
const room = networkClient.room(PEER_SELECTION_ROOM);
room.join();

const peerColors = ColorSequence.default;
const colorAllocator = {
  peerColor: (peerId: string) => peerColors.pick(peerId),
  release: () => void 0
};

const peerFrustumSync = new PeerFrustumSync({
  room,
  parent: scene,
  color: (clientId) => peerColors.pick(clientId)
});
peerFrustumSync.attach(camera);

const peerRegistry = new PeerHighlights({ colorAllocator });

const storedTechnique = kModeStorage.get(
  kModeStorageKey
) as MeshHighlightMode | null;
const highlight = new MeshHighlight({
  renderer,
  scene,
  camera,
  mode: storedTechnique && kKnownTechniques.includes(storedTechnique) ?
    storedTechnique :
    "outline",
  peers: peerRegistry,
  chips: true
});
for (const { id, object } of selectables.items) {
  highlight.register(id, object);
}

const peerHighlightSync = new PeerHighlightSync({
  room,
  highlight
});

let hoveredId: string | null = null;

onCanvasPick(canvas, {
  camera,
  pick: (raycaster) => selectables.pick(raycaster),
  onHover: (id) => {
    hoveredId = id;
    highlight.hover(id);
    refreshStatus();
  },
  onClick: (id) => highlight.select(id)
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
const peersRow = peersFolder.addNote({ label: "selecting" });
const peersListElt = document.createElement("div");
peersListElt.className = "peer-legend";
peersRow.element.appendChild(peersListElt);

function refreshPeersLegend(): void {
  const rows: { name: string; color: string; selected: string; }[] = [
    {
      name: `${username} (you)`,
      color: toHex(highlight.appearance.selected.color),
      selected: selectables.displayLabel(highlight.selected)
    }
  ];

  for (const [clientId, peer] of room.peers) {
    rows.push({
      name: network.parsePeerProfile(peer.profile).username,
      color: peerColors.pick(clientId),
      selected: selectables.displayLabel(peerRegistry.selectedObject(clientId))
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
  status.hovered = selectables.displayLabel(hoveredId);
  status.selected = selectables.displayLabel(highlight.selected);
  sessionFolder.refresh();
  refreshPeersLegend();
}

highlight.addEventListener("selectionChange", refreshStatus);
peerRegistry.addEventListener("change", refreshPeersLegend);
room.on("sync", refreshPeersLegend);
room.on("peer-joined", refreshPeersLegend);
room.on("peer-left", refreshPeersLegend);
refreshStatus();

bindHighlightAndPeerPanel({
  pane,
  highlight,
  maxDistance: { default: 30, max: 30 },
  onModeChange: (mode) => kModeStorage.set(kModeStorageKey, mode)
});

start({
  update: () => {
    peerFrustumSync.update();
    highlight.update();
  },
  render: () => highlight.render()
});

window.addEventListener("beforeunload", () => {
  peerHighlightSync.destroy();
  peerFrustumSync.destroy();
  highlight.dispose();
});
