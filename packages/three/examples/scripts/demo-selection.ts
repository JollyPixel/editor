// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import { TreeView } from "@jolly-pixel/fs-tree";

// Import Internal Dependencies
import { SelectionManager } from "../../src/index.ts";
import {
  createRenderer,
  createScene,
  createOrbitCamera,
  startLoop
} from "./utils/common.ts";
import { createExamplePane } from "./utils/pane.ts";

// CONSTANTS
// Pointer must stay within this many CSS pixels between down/up to count as
// a click rather than an orbit drag.
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

/**
 * Every ray-pickable mesh, each tagged (via `pickToId`) with the id it
 * resolves to: its own id for a standalone mesh, or - the first time it's
 * picked - the id of the group it belongs to. Picking the same group a
 * second time in a row drills in to the specific mesh instead, mirroring
 * how editors like Blender/Unity handle clicking into a multi-mesh asset.
 */
const selectableMeshes: THREE.Mesh[] = [];
const pickToId = new Map<THREE.Mesh, { id: string; groupId?: string; }>();
const displayNames = new Map<string, string>();

/**
 * Mirrors the ids registered on `selectionManager` as tree nodes, so the
 * outliner shows the exact same group/child hierarchy as the 3D scene
 * (a `THREE.Group` becomes a "group" node, a `THREE.Mesh` becomes an "item"
 * node nested under its group when it has one).
 */
const idToNode = new Map<string, HTMLLIElement>();
const nodeToId = new Map<HTMLLIElement, string>();

const selectionManager = new SelectionManager();
const treeView = new TreeView(
  document.querySelector("#outliner") as HTMLDivElement
);
spawnSelectableMeshes(scene, selectionManager, treeView);

/**
 * Tree -> 3D: clicking a node selects the id it mirrors. Only reacts to a
 * single selection since `SelectionManager` (unlike `TreeView`) tracks one
 * selected id at a time; `multipleSelection` is left at its default `false`.
 */
treeView.addEventListener("selectionChange", () => {
  const node = treeView.selector.firstSelectedNode as HTMLLIElement | null;
  selectionManager.select(node ? (nodeToId.get(node) ?? null) : null);
});

/**
 * 3D -> tree: picking a mesh/group in the canvas highlights and reveals the
 * matching node instead of leaving the outliner stale. Uses the selector
 * directly (not a simulated click) so this does not re-dispatch
 * `selectionChange` on the tree and loop back into the listener above.
 */
selectionManager.addEventListener("selectionChange", () => {
  treeView.selector.clear();

  const id = selectionManager.selected;
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

/**
 * A standalone mesh always resolves to its own id. A mesh that belongs to a
 * group resolves to the group's id first - only once that group is already
 * the active selection does it resolve to the specific mesh, so a second
 * pick "drills in" past the group.
 */
function resolvePickId(
  hit: THREE.Mesh
): string {
  const info = pickToId.get(hit);
  if (!info) {
    throw new Error(`No selection id registered for mesh "${hit.name}"`);
  }

  return info.groupId && info.groupId !== selectionManager.selected ? info.groupId : info.id;
}

function updateHover(): void {
  const hit = pickMesh();
  hovered = hit;
  selectionManager.hover(hit ? resolvePickId(hit) : null);
  refreshStatus();
}

function handleClick(): void {
  const hit = pickMesh();
  // refreshStatus() runs from the manager's own "selectionChange" listener,
  // which also keeps the outliner in sync - no need to call it here too.
  selectionManager.select(hit ? resolvePickId(hit) : null);
}

function createTreeNode(
  label: string
): HTMLLIElement {
  const nodeElt = document.createElement("li");
  const spanElt = document.createElement("span");
  spanElt.textContent = label;
  nodeElt.appendChild(spanElt);

  return nodeElt;
}

function spawnSelectableMeshes(
  target: THREE.Scene,
  selection: SelectionManager,
  outline: TreeView
): void {
  function registerStandalone(
    id: string,
    name: string,
    mesh: THREE.Mesh
  ): void {
    mesh.name = name;
    target.add(mesh);
    selection.register(id, mesh);
    selectableMeshes.push(mesh);
    pickToId.set(mesh, { id });
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

  const [box, cone, icosahedron] = selectableMeshes;
  box.position.set(-4, 0.7, 0);
  cone.position.set(-1.3, 0.9, 0);
  icosahedron.position.set(1.3, 1, 0);

  // A multi-mesh asset: clicking any part first selects the group as a
  // whole (bounding box), clicking again drills into that specific part.
  // Mirrored in the outliner as a "group" node with the parts nested as
  // "item" children, exactly like a folder and its files in `TreeView`.
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
    pickToId.set(mesh, { id, groupId: "cluster" });
    displayNames.set(id, `${mesh.name} (part of Cluster)`);

    const partNode = outline.append(createTreeNode(name), "item", clusterNode);
    idToNode.set(id, partNode);
    nodeToId.set(partNode, id);
  }
}

function material(
  color: THREE.ColorRepresentation = "#4a90d9"
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color });
}

const pane = createExamplePane();
const infoFolder = pane.addFolder({ title: "Selection" });
const status = {
  hovered: "-",
  selected: "-",
  hint: "Click a Cluster part twice: once for the group, again for that part."
};

infoFolder.addBinding(status, "hovered", { readonly: true, interval: 0 });
infoFolder.addBinding(status, "selected", { readonly: true, interval: 0 });
infoFolder.addBinding(status, "hint", { readonly: true, interval: 0 });

function refreshStatus(): void {
  status.hovered = hovered?.name ?? "-";
  status.selected = selectionManager.selected ? (displayNames.get(selectionManager.selected) ?? selectionManager.selected) : "-";
  infoFolder.refresh();
}

startLoop({
  renderer,
  scene,
  camera,
  controls
});
