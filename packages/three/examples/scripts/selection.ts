// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import { TreeView } from "@jolly-pixel/arbor";

// Import Internal Dependencies
import {
  SelectionManager,
  PeerSelectionRegistry,
  PeerSelectionOverlays,
  PeerHighlightPass,
  PeerSelectionVisibility,
  PeerSelectionChips,
  HighlightPass,
  HighlightPassJfa,
  createSelectionOverlay,
  type SelectionOverlay,
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
import { bindSelectionAndPeerPanel, type PeerRenderingMode } from "./utils/selection-panel.ts";
import { PeerColorPaletteAllocator } from "./network/PeerColorPaletteAllocator.ts";

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
 * Scene-level postprocess technique - an architecturally distinct option
 * alongside `SelectionManager`'s own "outline" per-object overlay (see
 * `HighlightPass`'s own doc comment for why: one shared pipeline for
 * the whole scene, not a per-id instance). `SelectionManager` never owns or
 * drives this directly - resolving an id to `technique: "highlight"`
 * just skips building a local overlay for it (see `SelectionTechnique`'s own
 * doc comment); `PeerHighlightPass` below (driven by "Peer rendering",
 * not `SelectionManager`'s own `technique`) is what actually reads
 * `selectionManager`'s state and renders through this. Driven via `render:`
 * in `startLoop` below only while "Peer rendering" is on "colors" - see
 * `setPeerRenderingMode`'s own doc comment for why.
 */
const highlight = new HighlightPass(renderer, scene, camera);

/**
 * Jump Flood Algorithm alternative to `highlight` above (see
 * `HighlightPassJfa`'s own doc comment) - offered as a third "Peer
 * rendering" mode (`"colorsJfa"`), so its uniform, resolution-independent
 * ring can be compared side-by-side against `HighlightPass`'s blur-based one
 * on the exact same scene/entries.
 */
const highlightJfa = new HighlightPassJfa(renderer, scene, camera);

const selectionManager = new SelectionManager();
const treeView = new TreeView(
  document.querySelector("#outliner") as HTMLDivElement
);
spawnSelectableMeshes(scene, selectionManager, treeView);

/**
 * Fake remote peers, driven by the "Presence" pane folder below - no real
 * `@jolly-pixel/network` wiring here, same local-only prototyping approach
 * as the rest of this demo. Both peer-rendering mechanisms below
 * (`PeerSelectionOverlays`/`PeerHighlightPass`, see
 * `setPeerRenderingMode`'s own doc comment) render exactly one 3D ring per
 * object (the primary/oldest selector's color), regardless of how many
 * peers select it; the full per-peer list shows two ways - as outliner
 * chips below (DOM, always up to date regardless of camera view, via
 * `refreshChips`) and, once more than one peer shares an object, as small
 * billboard chips directly above it in the 3D view (`PeerSelectionChips`,
 * constructed further down).
 *
 * `colorAllocator` is constructed here rather than left on
 * `PeerSelectionRegistry`'s own default so this demo, single-editor as it
 * is, still shows the injection point: in a real multi-editor workspace,
 * this same `PeerColorPaletteAllocator` instance could be constructed once
 * and shared across every editor's `PeerSelectionRegistry` so a peer's color
 * stays consistent across the whole session - a choice left entirely to the
 * app, never forced by this package or this demo.
 */
const peerRegistry = new PeerSelectionRegistry({
  colorAllocator: new PeerColorPaletteAllocator()
});

/**
 * Frustum + distance gating for peer indicators - see its own doc comment.
 * Shared across both "Peer rendering" mechanisms below, and `peerChips`
 * further down. Never affects the local user's own selection. `update()`
 * runs once per render tick, from `startLoop`'s `onFrame` at the bottom of
 * this file - orbit the camera away from a peer selection to see its
 * ring/chips disappear, or lower "max distance" in the "Peer rendering"
 * folder below.
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
 * object's own primary ring. Complements, rather than replaces, this file's
 * own pre-existing DOM-based `refreshChips` outliner chips below - that one
 * lists every selector in the sidebar regardless of camera view, this one
 * shows it directly in the 3D view. Shares `peerVisibility` with both
 * peer-rendering mechanisms above. Never referenced again after
 * construction - entirely event-driven internally, see its own doc comment.
 * `enabled: true` - defaults to `false` (opt-in) on the class itself, but
 * this demo exists specifically to show the feature, so it's turned on from
 * the start here.
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
 * control drives which one is active, and each mechanism's own doc comment
 * for what it actually builds.
 */
let peerSelectionOverlays: PeerSelectionOverlays | null = null;
let peerHighlight: PeerHighlightPass | null = null;
let peerRenderingMode: PeerRenderingMode = "overlays";

/**
 * Peer group selections have no box under "colors"/"colorsJfa" mode -
 * `PeerHighlightPass` only ever knows about per-mesh `HighlightEntry`
 * objects, so a peer selecting "Cluster" there rings each of its parts but
 * never the group as a whole - unlike "overlays" mode, where
 * `PeerSelectionOverlays`' own `SelectionOverlayRegistry` fallback already
 * builds a `SelectionBoundingBox` for any non-mesh peer target (see that
 * registry's own doc comment: a `THREE.Group` never supports the requested
 * or default technique, so it always falls through to `"boundingBox"`).
 * This keeps a peer's group selection visually consistent across every
 * peer-rendering mode - same fallback resolution `PeerSelectionOverlays`
 * uses internally, just also run - for non-mesh targets only - while
 * "colors"/"colorsJfa" is active, since "overlays" mode already covers it
 * via the real `PeerSelectionOverlays` instance. Local selection needs no
 * equivalent - `SelectionManager` itself already always renders a box for a
 * group regardless of technique (see its own doc comment).
 */
const peerGroupBoxes = new Map<string, SelectionOverlay>();

function refreshPeerGroupBoxes(): void {
  const relevantIds = new Set([...peerGroupBoxes.keys(), ...peerRegistry.selectedObjectIds()]);

  for (const objectId of relevantIds) {
    const existing = peerGroupBoxes.get(objectId);
    const target = selectionManager.targetFor(objectId);
    const isNonMeshTarget = target !== undefined && !(target instanceof THREE.Mesh);
    const isLocalSelected = objectId === selectionManager.selected;
    const culled = !peerVisibility.isVisible(objectId);
    const eligible = peerRenderingMode !== "overlays" && isNonMeshTarget && !isLocalSelected && !culled;
    const peerId = eligible ? peerRegistry.primarySelectorOf(objectId) : null;

    if (peerId === null) {
      existing?.dispose();
      peerGroupBoxes.delete(objectId);
      continue;
    }

    const color = peerRegistry.colorOf(peerId);
    if (existing) {
      existing.setColor(color);
      continue;
    }

    peerGroupBoxes.set(objectId, createSelectionOverlay(target!, {
      technique: selectionManager.techniqueFor(objectId),
      color,
      opacity: 1,
      fillOpacity: selectionManager.boundingBoxOptions.fillOpacity,
      xray: selectionManager.xray
    }));
  }
}

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

  refreshPeerGroupBoxes();
}

peerVisibility.addEventListener("visibilityChange", () => refreshPeerGroupBoxes());

peerRegistry.addEventListener("peerSelectionChange", (event) => {
  const { objectId, previousObjectId } = (event as CustomEvent<PeerSelectionChangeEventDetail>).detail;

  if (previousObjectId) {
    refreshChips(previousObjectId);
  }
  if (objectId) {
    refreshChips(objectId);
  }
  refreshPeerGroupBoxes();
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
  // The local selection suppresses any peer group box for the same object -
  // see `refreshPeerGroupBoxes`'s own doc comment.
  refreshPeerGroupBoxes();
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
  // Smooth/high-poly stand-in for a "real" imported model: every adjacent
  // face pair differs by more than SelectionOutline's edge threshold, so an
  // EdgesGeometry outline here reads as a busy wireframe rather than a clean
  // line - switch "mode" below to "highlight" to see
  // this one (and everything else) rendered via HighlightPass's
  // screen-space silhouette instead, which doesn't depend on edge angles at
  // all and stays clean here regardless of poly count.
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
const statusFolder = pane.addFolder({ title: "Status" });
const status = {
  hovered: "-",
  selected: "-"
};

statusFolder.addMonitor(status, "hovered");
statusFolder.addMonitor(status, "selected");

function refreshStatus(): void {
  status.hovered = hovered?.name ?? "-";
  status.selected = selectionManager.selected ? (displayNames.get(selectionManager.selected) ?? selectionManager.selected) : "-";
  statusFolder.refresh();
}

// A non-mesh target ("Cluster") always renders a `SelectionBoundingBox`
// regardless of mode, so `boundingBox: true` here shows "group opacity" -
// `selection-peer.ts` has no group and omits it.
bindSelectionAndPeerPanel({
  pane,
  selectionManager,
  peerVisibility,
  highlight,
  highlightJfa,
  peerChips,
  boundingBox: true,
  maxDistance: { default: 30, max: 30 },
  onPeerModeChange: setPeerRenderingMode,
  // Two separate peer-side group-box mechanisms, depending on "Peer
  // rendering" mode (see `peerGroupBoxes`'s own doc comment) - both need an
  // explicit nudge here, since `setBoundingBoxOptions` dispatches no event:
  // - "overlays" mode: the real `PeerSelectionOverlays` instance already
  //   builds a peer's group box itself; `refreshAll` re-applies the current
  //   fillOpacity to its already-built overlay (see its own doc comment).
  // - "colors"/"colorsJfa" mode: `refreshPeerGroupBoxes` on its own only
  //   recolors an existing entry, never rebuilds it, so a "group opacity"
  //   change alone would never reach one - clearing the map first forces
  //   every still-relevant entry back through the fresh-
  //   `createSelectionOverlay` branch, picking up the new fillOpacity the
  //   same way a brand new peer selection already would.
  onBoundingBoxOptionsChange: () => {
    peerSelectionOverlays?.refreshAll();

    for (const overlay of peerGroupBoxes.values()) {
      overlay.dispose();
    }
    peerGroupBoxes.clear();
    refreshPeerGroupBoxes();
  },
  // `PeerSelectionOverlays#refresh` only re-applies x-ray to an existing
  // overlay when something else triggers a refresh - `setXray` itself
  // dispatches no event, so an already peer-selected object needs this
  // explicit nudge. See `refreshAll`'s own doc comment.
  onXrayChange: () => peerSelectionOverlays?.refreshAll()
});

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
const fakePeers = {
  "Peer A": kNoneOption,
  "Peer B": kNoneOption,
  "Peer C": kNoneOption,
  "Peer D": kNoneOption,
  "Peer E": kNoneOption
};

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
  // Camera motion (orbit) is independent of any selection-change event -
  // see `PeerSelectionVisibility`'s own doc comment for why this has to run
  // every frame rather than only reacting to events.
  onFrame: () => peerVisibility.update(),
  // `highlight`/`highlightJfa` each own a full `RenderPipeline`, so one is
  // only used as the frame's render call while it's actually driving
  // anything (its own matching "Peer rendering" mode) - every other frame
  // renders normally.
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
