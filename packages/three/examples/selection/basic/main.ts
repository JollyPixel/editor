// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import { ColorPalette } from "@jolly-pixel/color";
import type { TreeNode } from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  SelectionSystem,
  PeerSelectionRegistry
} from "../../../src/index.ts";
import {
  createExample,
  orbitCamera
} from "../../shared/example.ts";
import { bindSelectionAndPeerPanel } from "../shared/selection-panel.ts";
import { onCanvasPick } from "../shared/pointer-picking.ts";
import {
  Selectables,
  addSelectionLighting,
  selectionMaterial
} from "../shared/selectables.ts";

// CONSTANTS
const kNoneOption = "";
const kPriorityOrbitRadius = 1.3;

const {
  canvas,
  renderer,
  scene,
  camera,
  pane,
  start
} = await createExample({
  title: "Selection",
  stats: false,
  camera: orbitCamera(
    { x: 6, y: 5, z: 8 },
    { x: 0, y: 0.5, z: 0 }
  )
});

addSelectionLighting(scene);

const colorPalette = new ColorPalette();
const peerRegistry = new PeerSelectionRegistry({
  colorAllocator: {
    colorOf: (peerId) => colorPalette.forKey(peerId),
    release: () => void 0
  }
});
const selection = new SelectionSystem({
  renderer,
  scene,
  camera,
  appearance: { xray: true },
  peerSelections: peerRegistry,
  chips: true
});

const selectables = new Selectables();
const outlinerNodes: TreeNode[] = [];

interface PriorityOrbiter {
  mesh: THREE.Mesh;
  angle: number;
  speed: number;
}

function registerStandalone(
  id: string,
  label: string,
  mesh: THREE.Mesh
): THREE.Mesh {
  mesh.name = label;
  scene.add(mesh);
  selection.register(id, mesh);
  selectables.add({ id, label, object: mesh });
  outlinerNodes.push({ id, label });

  return mesh;
}

const box = registerStandalone(
  "box",
  "Box",
  new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.4), selectionMaterial())
);
const cone = registerStandalone(
  "cone",
  "Cone",
  new THREE.Mesh(new THREE.ConeGeometry(1, 1.8, 8), selectionMaterial())
);
const icosahedron = registerStandalone(
  "icosahedron",
  "Icosahedron",
  new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), selectionMaterial())
);
const torusKnot = registerStandalone(
  "torusKnot",
  "Torus Knot",
  new THREE.Mesh(
    new THREE.TorusKnotGeometry(0.8, 0.28, 200, 32),
    selectionMaterial("#4ad991")
  )
);
box.position.set(-6, 0.7, 0);
cone.position.set(-3.3, 0.9, 0);
icosahedron.position.set(-0.7, 1, 0);
torusKnot.position.set(1.8, 1, 0);

const cluster = new THREE.Group();
cluster.name = "Cluster";
cluster.position.set(4.5, 0, 0);
scene.add(cluster);
selection.register("cluster", cluster);
selectables.add(
  {
    id: "cluster",
    label: "Cluster (group)",
    object: cluster
  },
  false
);

const clusterChildren: TreeNode[] = [];
outlinerNodes.push({
  id: "cluster",
  label: "Cluster",
  children: clusterChildren
});

const kClusterParts: [string, THREE.Mesh, THREE.Vector3Tuple][] = [
  [
    "Sphere",
    new THREE.Mesh(
      new THREE.SphereGeometry(0.6, 16, 12),
      selectionMaterial("#d97a4a")
    ),
    [0, 1.2, 0]
  ],
  [
    "Torus",
    new THREE.Mesh(
      new THREE.TorusGeometry(0.6, 0.2, 8, 16),
      selectionMaterial("#d97a4a")
    ),
    [-1, 0.5, 0.3]
  ],
  [
    "Cylinder",
    new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, 1.2, 12),
      selectionMaterial("#d97a4a")
    ),
    [1, 0.6, -0.3]
  ]
];

for (const [index, [name, mesh, position]] of kClusterParts.entries()) {
  mesh.name = `Cluster.${name}`;
  mesh.position.set(...position);
  cluster.add(mesh);

  const id = `cluster-${index}`;
  selection.register(id, mesh);
  selectables.add({
    id,
    label: `${mesh.name} (part of Cluster)`,
    object: mesh
  });

  clusterChildren.push({ id, label: name });
}

const priorityOrbitCenter = cone.position.clone();
const priorityOrbiters: PriorityOrbiter[] = [
  {
    mesh: registerStandalone(
      "orbiterBox",
      "Orbiter Box",
      new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.6, 0.6),
        selectionMaterial("#8c5a6b")
      )
    ),
    angle: 0,
    speed: 0.6
  },
  {
    mesh: registerStandalone(
      "orbiterTetra",
      "Orbiter Tetra",
      new THREE.Mesh(
        new THREE.TetrahedronGeometry(0.55),
        selectionMaterial("#5a8c7a")
      )
    ),
    angle: (Math.PI * 2) / 3,
    speed: -0.45
  },
  {
    mesh: registerStandalone(
      "orbiterOcta",
      "Orbiter Octa",
      new THREE.Mesh(
        new THREE.OctahedronGeometry(0.55),
        selectionMaterial("#8c7a5a")
      )
    ),
    angle: (Math.PI * 4) / 3,
    speed: 0.8
  }
];

function applyOrbiterPositions(): void {
  for (const orbiter of priorityOrbiters) {
    orbiter.mesh.position.set(
      priorityOrbitCenter.x + (Math.cos(orbiter.angle) * kPriorityOrbitRadius),
      priorityOrbitCenter.y,
      priorityOrbitCenter.z + (Math.sin(orbiter.angle) * kPriorityOrbitRadius)
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
scene.add(wall);

const outlinerPane = document.querySelector<HTMLElementTagNameMap["jolly-pane"]>(
  "#outliner jolly-pane"
);
if (outlinerPane === null) {
  throw new Error("selection: no #outliner jolly-pane in this page's HTML");
}

const tree = document.createElement("jolly-tree");
tree.expanded = ["cluster"];
outlinerPane.append(tree);
refreshOutliner();

peerRegistry.addEventListener("peerSelectionChange", () => {
  refreshOutliner();
});

tree.addEventListener("jolly-select", (event) => {
  selection.select(event.detail.selected[0] ?? null);
});

tree.addEventListener("jolly-toggle-expand", (event) => {
  const { id, expanded } = event.detail;
  tree.expanded = expanded ?
    [...tree.expanded, id] :
    tree.expanded.filter((expandedId) => expandedId !== id);
});

selection.addEventListener("selectionChange", () => {
  const id = selection.selected;
  tree.selected = id ? [id] : [];

  refreshStatus();
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

function withPeerBadges(
  node: TreeNode
): TreeNode {
  return {
    ...node,
    badges: peerRegistry.selectorsOf(node.id).map((peerId) => {
      return {
        color: peerRegistry.colorOf(peerId),
        title: peerId
      };
    }),
    children: node.children?.map(withPeerBadges)
  };
}

function refreshOutliner(): void {
  tree.nodes = outlinerNodes.map(withPeerBadges);
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

function reshuffleOrbiters(): void {
  for (const orbiter of priorityOrbiters) {
    orbiter.angle = Math.random() * Math.PI * 2;
  }
  applyOrbiterPositions();
}

const statusFolder = pane.addFolder({ title: "Status" });
const status = {
  hovered: "-",
  selected: "-"
};

statusFolder.addMonitor(status, "hovered");
statusFolder.addMonitor(status, "selected");

function refreshStatus(): void {
  status.hovered = selectables.labelOf(hoveredId);
  status.selected = selectables.labelOf(selection.selected);
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

const presenceOptions: Record<string, string> = { "(none)": kNoneOption };
for (const { id, label } of selectables.items) {
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

start({
  update: () => {
    advanceOrbiters();
    selection.update();
  },
  render: () => selection.render()
});
