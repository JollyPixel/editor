// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import { TreeView } from "@jolly-pixel/fs-tree";

// Import Internal Dependencies
import {
  SelectionManager,
  PeerSelectionRegistry,
  PeerSelectionOverlays,
  ToonOutlinePass,
  type MeshSelectionStyle,
  type PeerSelectionChangeEventDetail
} from "../../src/index.ts";
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
 * resolves to. A 3D-view pick always resolves straight to the specific
 * mesh under the cursor, never to a parent group - drilling through a
 * group's own selection state stays a `TreeView`-only affordance (see the
 * `treeView` "selectionChange" listener below), so deeply nested groups
 * never cost extra clicks in the canvas.
 */
const selectableMeshes: THREE.Mesh[] = [];
const pickToId = new Map<THREE.Mesh, string>();
const displayNames = new Map<string, string>();

/**
 * Mirrors the ids registered on `selectionManager` as tree nodes, so the
 * outliner shows the exact same group/child hierarchy as the 3D scene
 * (a `THREE.Group` becomes a "group" node, a `THREE.Mesh` becomes an "item"
 * node nested under its group when it has one).
 */
const idToNode = new Map<string, HTMLLIElement>();
const nodeToId = new Map<HTMLLIElement, string>();

/**
 * Scene-level postprocess technique - a fourth-in-spirit but architecturally
 * distinct option alongside `SelectionManager`'s own "outline"/"highlight"
 * per-object overlays (see `ToonOutlinePass`'s own doc comment for why:
 * one shared pipeline for the whole scene, not a per-id instance).
 * `selectionManager` below is given this directly, so a per-id or
 * `meshStyle: "toonOutline"` just works like any other style - no manual
 * `sync`/event wiring needed on this demo's part. Always driving the
 * frame's draw call via `startLoop`'s `render` override below is safe
 * regardless of whether anything is currently using this style: with
 * nothing pushed into it, `ToonOutlinePass` composites down to exactly the
 * normal scene render.
 */
const toonOutline = new ToonOutlinePass(renderer, scene, camera);

const selectionManager = new SelectionManager({ toonOutline });
const treeView = new TreeView(
  document.querySelector("#outliner") as HTMLDivElement
);
spawnSelectableMeshes(scene, selectionManager, treeView);

/**
 * Fake remote peers, driven by the "Presence" pane folder below - no real
 * `@jolly-pixel/network` wiring here, same local-only prototyping approach
 * as the rest of this demo. `PeerSelectionOverlays` renders exactly one 3D
 * overlay per object (the primary/oldest selector's color), regardless of
 * how many peers select it; the full per-peer list is rendered as outliner
 * chips below instead, via `refreshChips`.
 */
const peerRegistry = new PeerSelectionRegistry();
new PeerSelectionOverlays({ registry: peerRegistry, selection: selectionManager });

peerRegistry.addEventListener("peerSelectionChange", (event) => {
  const { objectId, previousObjectId } = (event as CustomEvent<PeerSelectionChangeEventDetail>).detail;

  if (previousObjectId) {
    refreshChips(previousObjectId);
  }
  if (objectId) {
    refreshChips(objectId);
  }
});

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
 * 3D -> tree: picking a mesh in the canvas highlights and reveals the
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

  const presenceElt = document.createElement("span");
  presenceElt.className = "presence";
  nodeElt.appendChild(presenceElt);

  return nodeElt;
}

/**
 * Renders one round chip per peer currently selecting `objectId`, oldest
 * first - the full detail `PeerSelectionOverlays` deliberately leaves out
 * of the 3D view (which only ever shows the primary/oldest selector).
 * `TreeView` has no decoration API of its own, so this reaches directly
 * into the `.presence` element `createTreeNode` already appended into the
 * node's own `<li>`.
 */
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

function spawnSelectableMeshes(
  target: THREE.Scene,
  selection: SelectionManager,
  outline: TreeView
): void {
  function registerStandalone(
    id: string,
    name: string,
    mesh: THREE.Mesh,
    style?: MeshSelectionStyle
  ): void {
    mesh.name = name;
    target.add(mesh);
    selection.register(id, mesh, { style });
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
  // Smooth/high-poly stand-in for a "real" imported model: every adjacent
  // face pair differs by more than SelectionOutline's edge threshold, so an
  // EdgesGeometry outline here would draw as a busy wireframe rather than a
  // clean line - registered with the "highlight" style (inverted-hull rim)
  // instead, which doesn't depend on edge angles at all. This per-id style
  // only lasts until the "mesh style" dropdown below is touched - setMeshStyle
  // forces every mesh (this one included) to the chosen style.
  registerStandalone(
    "torusKnot",
    "Torus Knot",
    new THREE.Mesh(new THREE.TorusKnotGeometry(0.8, 0.28, 200, 32), material("#4ad991")),
    "highlight"
  );

  const [box, cone, icosahedron, torusKnot] = selectableMeshes;
  box.position.set(-6, 0.7, 0);
  cone.position.set(-3.3, 0.9, 0);
  icosahedron.position.set(-0.7, 1, 0);
  torusKnot.position.set(1.8, 1, 0);

  // A multi-mesh asset: clicking any part in the 3D view selects that part
  // directly. The group as a whole (bounding box) is only reachable from the
  // outliner, where it's mirrored as a "group" node with the parts nested as
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
    pickToId.set(mesh, id);
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

const pane = createExamplePane({ title: "Selection" });
const infoFolder = pane.addFolder({ title: "Selection" });
const status = {
  hovered: "-",
  selected: "-"
};

infoFolder.addMonitor(status, "hovered");
infoFolder.addMonitor(status, "selected");

// No field/monitor fits a paragraph (`jolly-monitor`'s value column doesn't
// wrap; see `jolly-property-row`'s own doc comment for why that one does) -
// built directly and appended to `folder.element`, the facade's own
// documented escape hatch for content it has no builder for
// (`disposeAll()` only removes what a builder created, so this survives a
// `bindGridControls`-style rebuild the same way as everything else here,
// which never rebuilds this folder).
const hintRow = document.createElement("jolly-property-row");
hintRow.description = "Torus Knot starts on the highlight style (edge outline reads busy on it); the rest start " +
  "on edge outline. Mesh Style below overrides all of them, Torus Knot included, and includes " +
  "a third technique - toon outline (postprocess). The Cluster group itself (pick it from the " +
  "outliner) always stays a bounding box no matter the style, but its individual parts (pick " +
  "one directly in the 3D view) follow Mesh Style like any other mesh. Outline width/highlight " +
  "thickness/toon outline edge thickness only affect the matching style; x-ray applies to all " +
  "three - try it on a Cluster part while another mesh occludes it (with toon outline active, " +
  "watch \"hidden color\" show through instead of the same color). Use Presence below to see " +
  "peer chips vs. the single 3D overlay - a peer selection always uses the outline style, even " +
  "if Mesh Style above is on toon outline, since that technique can't represent more than one " +
  "simultaneous colored selection.";
infoFolder.element.append(hintRow);

/**
 * Global selection technique, switchable at runtime - forces every id to
 * match, including the Torus Knot's own per-id "highlight" override above
 * (register's per-id `style` only lasts until the next setMeshStyle call).
 * A group (e.g. "Cluster" here) always stays a `SelectionBoundingBox`
 * regardless of this setting, "toonOutline" included - see
 * `SelectionManager`'s own doc comment for why. Its individual parts are
 * ordinary meshes though, so they follow this setting like anything else -
 * pick one directly in the 3D view (not the "Cluster" outliner node) to try
 * toon outline on it.
 */
const styleSettings = { meshStyle: selectionManager.meshStyle };
infoFolder
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
  });

/**
 * Colors for the "selected" and "hover" overlays, independent of mesh style -
 * every setter here rebuilds/recolors the active overlay(s) in place, so
 * dragging a color swatch previews live on whatever is currently
 * selected/hovered. Also pushed to `toonOutline` (kept in sync regardless of
 * the active style, see `SelectionManager.setColor`'s own doc comment), so
 * these apply equally once "mesh style" is switched to "toonOutline".
 */
const colorSettings = {
  color: `#${new THREE.Color(selectionManager.color).getHexString()}`,
  hoverColor: `#${new THREE.Color(selectionManager.hoverColor).getHexString()}`,
  hoverOpacity: selectionManager.hoverOpacity
};
infoFolder
  .addBinding(colorSettings, "color", { label: "selected color" })
  .on("change", ({ value }) => selectionManager.setColor(value));
infoFolder
  .addBinding(colorSettings, "hoverColor", { label: "hover color" })
  .on("change", ({ value }) => selectionManager.setHoverColor(value));
infoFolder
  .addBinding(colorSettings, "hoverOpacity", { label: "hover opacity", min: 0, max: 1, step: 0.05 })
  .on("change", ({ value }) => selectionManager.setHoverOpacity(value));

/**
 * SelectionOutline/SelectionHighlight tuning, applied to every mesh
 * currently rendered with the matching style - see `setOutlineOptions`/
 * `setHighlightOptions` on SelectionManager. Both rebuild the active
 * selection/hover overlays immediately, same as the "mesh style" dropdown
 * above.
 */
const outlineSettings = { linewidth: 1 };
infoFolder
  .addBinding(outlineSettings, "linewidth", { label: "outline width", min: 1, max: 10, step: 1 })
  .on("change", ({ value }) => selectionManager.setOutlineOptions({ linewidth: value }));

const highlightSettings = { thickness: 0.03 };
infoFolder
  .addBinding(highlightSettings, "thickness", { label: "highlight thickness", min: 0.005, max: 0.2, step: 0.005 })
  .on("change", ({ value }) => selectionManager.setHighlightOptions({ thickness: value }));

/**
 * `ToonOutlinePass` tuning, applied whenever "mesh style" is on
 * "toonOutline" - see `setToonOutlineOptions` on `SelectionManager`.
 * `edgeThickness` is this technique's equivalent of outline width/highlight
 * thickness above; `hiddenColor` has no equivalent on the other two styles -
 * it's the color of the portion of the outline behind an occluder, always
 * computed, only gated on/off by "x-ray" below (not recolored by it).
 */
const toonOutlineSettings = {
  edgeThickness: selectionManager.toonOutlineOptions.edgeThickness ?? toonOutline.edgeThickness,
  hiddenColor: `#${toonOutline.hiddenColor.getHexString()}`
};
infoFolder
  .addBinding(toonOutlineSettings, "edgeThickness", { label: "toon outline edge thickness", min: 1, max: 10, step: 1 })
  .on("change", ({ value }) => selectionManager.setToonOutlineOptions({ edgeThickness: value }));
infoFolder
  .addBinding(toonOutlineSettings, "hiddenColor", { label: "toon outline hidden color" })
  .on("change", ({ value }) => selectionManager.setToonOutlineOptions({ hiddenColor: value }));

/**
 * X-ray, unlike outline width/highlight thickness/edge thickness, applies
 * uniformly no matter which technique is active (SelectionOutline,
 * SelectionHighlight, a group's SelectionBoundingBox, or ToonOutlinePass) -
 * so it's a single toggle here rather than living under any one style's own
 * settings. For "toonOutline" specifically, this only gates whether the
 * "hidden color" above shows through occluders at all, it doesn't change
 * which color is used (see `ToonOutlinePassOptions.xray`'s own doc comment).
 */
const xraySettings = { xray: selectionManager.xray };
infoFolder
  .addBinding(xraySettings, "xray", { label: "x-ray (see through occluders)" })
  .on("change", ({ value }) => selectionManager.setXray(value));

function refreshStatus(): void {
  status.hovered = hovered?.name ?? "-";
  status.selected = selectionManager.selected ? (displayNames.get(selectionManager.selected) ?? selectionManager.selected) : "-";
  infoFolder.refresh();
}

/**
 * Fake peers, each a dropdown over every registered id plus "(none)". Purely
 * a way to drive `peerRegistry` by hand for this demo - see the comment on
 * `peerRegistry` above for why this isn't real networking.
 */
const kNoneOption = "";
const presenceOptions: Record<string, string> = { "(none)": kNoneOption };
for (const [id, label] of displayNames) {
  presenceOptions[label] = id;
}

const presenceFolder = pane.addFolder({ title: "Presence" });
const fakePeers = { "Peer A": kNoneOption, "Peer B": kNoneOption, "Peer C": kNoneOption };

for (const peerId of Object.keys(fakePeers) as (keyof typeof fakePeers)[]) {
  presenceFolder
    .addBinding(fakePeers, peerId, { options: presenceOptions, label: peerId })
    .on("change", ({ value }) => {
      peerRegistry.select(peerId, value === kNoneOption ? null : value);
    });
}

startLoop({
  renderer,
  scene,
  camera,
  controls,
  // Safe to always route through the pipeline - see `toonOutline`'s own
  // comment above for why this composites down to the normal scene render
  // when nothing is currently using the "toonOutline" style.
  render: () => toonOutline.render()
});
