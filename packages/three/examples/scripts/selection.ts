// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import { TreeView } from "@jolly-pixel/arbor";

// Import Internal Dependencies
import {
  SelectionSystem,
  type SelectionManager,
  PeerSelectionRegistry,
  type SelectionTechnique,
  type PeerSelectionChangeEventDetail
} from "../../src/index.ts";
import {
  createRenderer,
  createScene,
  createOrbitCamera,
  startLoop
} from "./utils/common.ts";
import { createExamplePane } from "./utils/example-switcher.ts";
import { bindSelectionAndPeerPanel } from "./utils/selection-panel.ts";
import { PeerColorPaletteAllocator } from "./network/PeerColorPaletteAllocator.ts";

// CONSTANTS
const kClickDragThresholdPx = 4;

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

const selectableMeshes: THREE.Mesh[] = [];
const pickToId = new Map<THREE.Mesh, string>();
const displayNames = new Map<string, string>();

const idToNode = new Map<string, HTMLLIElement>();
const nodeToId = new Map<HTMLLIElement, string>();

const peerRegistry = new PeerSelectionRegistry({
  colorAllocator: new PeerColorPaletteAllocator()
});
const selection = new SelectionSystem({
  renderer,
  scene,
  camera,
  appearance: { xray: true },
  peerSelections: peerRegistry,
  chips: true
});
const selectionManager = selection.manager;
const treeView = new TreeView(
  document.querySelector("#outliner") as HTMLDivElement
);
const { priorityOrbiters, wall, applyOrbiterPositions } = spawnSelectableMeshes(scene, selectionManager, treeView);

peerRegistry.addEventListener("peerSelectionChange", (event) => {
  const { objectId, previousObjectId } = (event as CustomEvent<PeerSelectionChangeEventDetail>).detail;

  if (previousObjectId) {
    refreshChips(previousObjectId);
  }
  if (objectId) {
    refreshChips(objectId);
  }
});

treeView.addEventListener("selectionChange", () => {
  const node = treeView.selector.firstSelectedNode as HTMLLIElement | null;
  selection.select(node ? (nodeToId.get(node) ?? null) : null);
});

selection.addEventListener("selectionChange", () => {
  treeView.selector.clear();

  const id = selection.selected;
  const node = id ? idToNode.get(id) : undefined;
  if (node) {
    treeView.selector.add(node);
    treeView.scrollIntoView(node);
  }

  refreshStatus();
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
  selection.hover(hit ? resolvePickId(hit) : null);
  refreshStatus();
}

function handleClick(): void {
  const hit = pickMesh();
  // refreshStatus() runs from the manager's own "selectionChange" listener,
  // which also keeps the outliner in sync - no need to call it here too.
  selection.select(hit ? resolvePickId(hit) : null);
}

function createTreeNode(
  label: string
): HTMLLIElement {
  const nodeElt = document.createElement("li");
  const spanElt = document.createElement("span");
  spanElt.textContent = label;
  nodeElt.appendChild(spanElt);

  const presenceElt = document.createElement("span");
  presenceElt.className = "presence";
  nodeElt.appendChild(presenceElt);

  return nodeElt;
}

function refreshChips(
  objectId: string
): void {
  const node = idToNode.get(objectId);
  const presenceElt = node?.querySelector<HTMLSpanElement>(":scope > .presence");
  if (!presenceElt) {
    return;
  }

  presenceElt.replaceChildren(...peerRegistry.selectorsOf(objectId).map((peerId) => {
    const chipElt = document.createElement("span");
    chipElt.className = "peer-chip";
    chipElt.style.backgroundColor = peerRegistry.colorOf(peerId);
    chipElt.title = peerId;

    return chipElt;
  }));
}

/** Radians/second - a negative value orbits the opposite direction. */
interface PriorityOrbiter {
  id: string;
  mesh: THREE.Mesh;
  angle: number;
  speed: number;
}

interface SpawnedScene {
  priorityOrbiters: PriorityOrbiter[];
  wall: THREE.Mesh;
  applyOrbiterPositions: () => void;
}

function spawnSelectableMeshes(
  target: THREE.Scene,
  selection: SelectionManager,
  outline: TreeView
): SpawnedScene {
  function registerStandalone(
    id: string,
    name: string,
    mesh: THREE.Mesh,
    technique?: SelectionTechnique
  ): void {
    mesh.name = name;
    target.add(mesh);
    selection.register(id, mesh, { technique });
    selectableMeshes.push(mesh);
    pickToId.set(mesh, id);
    displayNames.set(id, name);

    const node = outline.append(createTreeNode(name), "item");
    idToNode.set(id, node);
    nodeToId.set(node, id);
  }

  registerStandalone(
    "box",
    "Box",
    new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.4), material())
  );
  registerStandalone(
    "cone",
    "Cone",
    new THREE.Mesh(new THREE.ConeGeometry(1, 1.8, 8), material())
  );
  registerStandalone(
    "icosahedron",
    "Icosahedron",
    new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), material())
  );
  registerStandalone(
    "torusKnot",
    "Torus Knot",
    new THREE.Mesh(new THREE.TorusKnotGeometry(0.8, 0.28, 200, 32), material("#4ad991"))
  );

  const [box, cone, icosahedron, torusKnot] = selectableMeshes;
  box.position.set(-6, 0.7, 0);
  cone.position.set(-3.3, 0.9, 0);
  icosahedron.position.set(-0.7, 1, 0);
  torusKnot.position.set(1.8, 1, 0);

  const cluster = new THREE.Group();
  cluster.name = "Cluster";
  cluster.position.set(4.5, 0, 0);
  target.add(cluster);
  selection.register("cluster", cluster);
  displayNames.set("cluster", "Cluster (group)");

  const clusterNode = outline.append(createTreeNode("Cluster"), "group");
  idToNode.set("cluster", clusterNode);
  nodeToId.set(clusterNode, "cluster");

  const clusterParts: [string, THREE.Mesh, THREE.Vector3Tuple][] = [
    ["Sphere", new THREE.Mesh(new THREE.SphereGeometry(0.6, 16, 12), material("#d97a4a")), [0, 1.2, 0]],
    ["Torus", new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.2, 8, 16), material("#d97a4a")), [-1, 0.5, 0.3]],
    ["Cylinder", new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.2, 12), material("#d97a4a")), [1, 0.6, -0.3]]
  ];

  for (const [index, [name, mesh, position]] of clusterParts.entries()) {
    mesh.name = `Cluster.${name}`;
    mesh.position.set(...position);
    cluster.add(mesh);

    const id = `cluster-${index}`;
    selection.register(id, mesh);
    selectableMeshes.push(mesh);
    pickToId.set(mesh, id);
    displayNames.set(id, `${mesh.name} (part of Cluster)`);

    const partNode = outline.append(createTreeNode(name), "item", clusterNode);
    idToNode.set(id, partNode);
    nodeToId.set(partNode, id);
  }

  const priorityOrbitCenter = cone.position.clone();
  const priorityOrbitRadius = 1.3;

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
    const mesh = new THREE.Mesh(geometry, material(color));
    registerStandalone(id, name, mesh);

    return { id, mesh, angle, speed };
  }

  const priorityOrbiters: PriorityOrbiter[] = [
    spawnOrbiter({
      id: "orbiterBox",
      name: "Orbiter Box",
      geometry: new THREE.BoxGeometry(0.6, 0.6, 0.6),
      color: "#8c5a6b",
      angle: 0,
      speed: 0.6
    }),
    spawnOrbiter({
      id: "orbiterTetra",
      name: "Orbiter Tetra",
      geometry: new THREE.TetrahedronGeometry(0.55),
      color: "#5a8c7a",
      angle: (Math.PI * 2) / 3,
      speed: -0.45
    }),
    spawnOrbiter({
      id: "orbiterOcta",
      name: "Orbiter Octa",
      geometry: new THREE.OctahedronGeometry(0.55),
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

  const wall = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 1.4, 1.4),
    new THREE.MeshStandardMaterial({ color: "#2a2a38" })
  );
  wall.name = "Occluder Wall";
  wall.position.set(0.6, 1.8, 1.6);
  target.add(wall);

  return { priorityOrbiters, wall, applyOrbiterPositions };
}

function material(
  color: THREE.ColorRepresentation = "#4a90d9"
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color });
}

const orbitClock = new THREE.Clock();
let orbitEnabled = true;

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

const pane = createExamplePane({ title: "Selection" });
const statusFolder = pane.addFolder({ title: "Status" });
const status = {
  hovered: "-",
  selected: "-"
};

statusFolder.addMonitor(status, "hovered");
statusFolder.addMonitor(status, "selected");

function refreshStatus(): void {
  status.hovered = hovered?.name ?? "-";
  status.selected = selection.selected ?
    (displayNames.get(selection.selected) ?? selection.selected) : "-";
  statusFolder.refresh();
}

const priorityStackFolder = pane.addFolder({ title: "Priority stack" });

const priorityStackHintRow = document.createElement("jolly-property-row");
priorityStackHintRow.description = "Orbiters keep overlapping Cone - stays visible through them in " +
  "either highlight mode below, not in outline mode.";
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

bindSelectionAndPeerPanel({
  pane,
  selection,
  boundingBox: true,
  maxDistance: { default: 30, max: 30 },
  extraPeerBindings: (peerFolder) => {
    const occluderSettings = { visible: wall.visible };
    peerFolder
      .addBinding(occluderSettings, "visible", { label: "show occluder" })
      .on("change", ({ value }) => {
        wall.visible = value;
      });
  }
});

const kNoneOption = "";
const presenceOptions: Record<string, string> = { "(none)": kNoneOption };
for (const [id, label] of displayNames) {
  presenceOptions[label] = id;
}

const presenceFolder = pane.addFolder({ title: "Presence" });
const fakePeers = {
  "Peer A": "torusKnot",
  "Peer B": "torusKnot",
  "Peer C": "orbiterBox",
  "Peer D": kNoneOption,
  "Peer E": kNoneOption
};

for (const peerId of Object.keys(fakePeers) as (keyof typeof fakePeers)[]) {
  presenceFolder
    .addBinding(fakePeers, peerId, { options: presenceOptions, label: peerId })
    .on("change", ({ value }) => {
      peerRegistry.select(peerId, value === kNoneOption ? null : value);
    });

  const presetValue = fakePeers[peerId];
  if (presetValue !== kNoneOption) {
    peerRegistry.select(peerId, presetValue);
  }
}

selection.select("cone");
refreshStatus();

startLoop({
  renderer,
  scene,
  camera,
  controls,
  onFrame: () => {
    advanceOrbiters();
    selection.update();
  },
  render: () => selection.render()
});
