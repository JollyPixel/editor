// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import { TreeView } from "@jolly-pixel/arbor";

// Import Internal Dependencies
import {
  SelectionManager,
  PeerSelectionRegistry,
  PeerSelectionOverlays,
  PeerColoredOutlinePass,
  PeerSelectionVisibility,
  PeerSelectionChips,
  ColoredOutlinePass,
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
import { PeerColorPaletteAllocator } from "./network/PeerColorPaletteAllocator.ts";
import { JumpFloodOutlinePass } from "./utils/JumpFloodOutlinePass.ts";

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
 * `ColoredOutlinePass`'s own doc comment for why: one shared pipeline for
 * the whole scene, not a per-id instance). `SelectionManager` never owns or
 * drives this directly - resolving an id to `technique: "coloredOutline"`
 * just skips building a local overlay for it (see `SelectionTechnique`'s own
 * doc comment); `PeerColoredOutlinePass` below (driven by "Peer rendering",
 * not `SelectionManager`'s own `technique`) is what actually reads
 * `selectionManager`'s state and renders through this. Driven via `render:`
 * in `startLoop` below only while "Peer rendering" is on "colors" - see
 * `setPeerRenderingMode`'s own doc comment for why.
 */
const coloredOutline = new ColoredOutlinePass(renderer, scene, camera);

/**
 * Phase 6 research-spike prototype (see its own doc comment) - a Jump Flood
 * Algorithm outline, offered as a third "Peer rendering" mode
 * (`"colorsJfa"`) alongside `coloredOutline` above, so its uniform,
 * resolution-independent ring can be compared side-by-side against
 * `ColoredOutlinePass`'s blur-based one on the exact same scene/entries.
 * Deliberately lives in `examples/`, not `src/` - not a published package
 * API, no occlusion/priority/instancing support, purely for this visual
 * comparison.
 */
const jfaOutline = new JumpFloodOutlinePass(renderer, scene, camera);

const selectionManager = new SelectionManager();
const treeView = new TreeView(
  document.querySelector("#outliner") as HTMLDivElement
);
spawnSelectableMeshes(scene, selectionManager, treeView);

/**
 * Fake remote peers, driven by the "Presence" pane folder below - no real
 * `@jolly-pixel/network` wiring here, same local-only prototyping approach
 * as the rest of this demo. Both peer-rendering mechanisms below
 * (`PeerSelectionOverlays`/`PeerColoredOutlinePass`, see
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
 * which of `PeerSelectionOverlays`/`PeerColoredOutlinePass` is drawing that
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
new PeerSelectionChips({
  registry: peerRegistry,
  selection: selectionManager,
  visibility: peerVisibility,
  enabled: true
});

/**
 * "Peer rendering" mode - the two peer-layer mechanisms this package ships,
 * mutually exclusive here so the scene stays legible (both would otherwise
 * draw their own ring around the same peer-selected object):
 * - `"overlays"` (`PeerSelectionOverlays`): one disposable
 *   `SelectionOutline`/`SelectionBoundingBox` per peer-selected object,
 *   reusing `selectionManager`'s own `technique`/`xray` - matches the local
 *   look 1:1 for `"outline"`, but falls back to `"outline"` for a peer when
 *   `technique` resolves to `"coloredOutline"` (see `PeerSelectionOverlays`'s
 *   own doc comment: a single shared `ColoredOutlinePass` isn't a per-object
 *   instance a peer overlay can build one of per selecting peer).
 * - `"colors"` (`PeerColoredOutlinePass` + `ColoredOutlinePass`): one shared
 *   postprocess pass, arbitrary simultaneous peer colors, always fully
 *   visible regardless of real scene occlusion (see `ColoredOutlinePass`'s
 *   own doc comment for why), and a `priority` entry for the local selection
 *   that wins any on-screen overlap with a peer's regardless of depth -
 *   including full on-screen enclosure by a much larger/nearer peer
 *   selection (see `ColoredOutlinePass`'s own doc comment on its
 *   priority-only mask/edge-detect chain).
 * - `"colorsJfa"` (`PeerColoredOutlinePass` + `JumpFloodOutlinePass`): the
 *   same `PeerColoredOutlinePass` adapter, pointed at the Phase 6 research
 *   prototype instead - same entries, arbitrary colors, the same `priority`
 *   guarantee as `"colors"` (see `JumpFloodOutlinePass`'s own doc comment),
 *   but a uniform, resolution-independent ring instead of a blurred one.
 *   Exists purely to compare edge quality side-by-side against `"colors"` on
 *   the same scene.
 *
 * "selection technique" and this mode are kept in sync *both* ways, not just
 * "selection technique" -> mode as a one-time default - `"overlays"` always
 * forces technique back to `"outline"`, and `"colors"`/`"colorsJfa"` always
 * force it to `"coloredOutline"`. This isn't just tidiness: `SelectionManager`
 * skips building its own local overlay whenever technique is
 * `"coloredOutline"` (assuming `ColoredOutlinePass` is handling it), while
 * `PeerSelectionOverlays` (`"overlays"` mode) never renders the local
 * selection at all (peer-only, by design) - decoupling the two used to mean
 * the *local* selection could render nothing at all, not just a peer falling
 * back to a plain line-segment look. `"colors"` <-> `"colorsJfa"` stays a free
 * choice either way (both already imply `"coloredOutline"`), which is how to
 * compare the JFA prototype against the primary technique on the same scene.
 */
type PeerRenderingMode = "overlays" | "colors" | "colorsJfa";
let peerSelectionOverlays: PeerSelectionOverlays | null = null;
let peerColoredOutline: PeerColoredOutlinePass | null = null;
let peerRenderingMode: PeerRenderingMode = "overlays";

function setPeerRenderingMode(
  mode: PeerRenderingMode
): void {
  peerRenderingMode = mode;

  peerSelectionOverlays?.dispose();
  peerSelectionOverlays = null;
  peerColoredOutline?.dispose();
  peerColoredOutline = null;
  coloredOutline.setEntries([]);
  jfaOutline.setEntries([]);

  if (mode === "overlays") {
    peerSelectionOverlays = new PeerSelectionOverlays({
      registry: peerRegistry, selection: selectionManager, visibility: peerVisibility
    });
  }
  else {
    peerColoredOutline = new PeerColoredOutlinePass({
      registry: peerRegistry,
      selection: selectionManager,
      coloredOutline: mode === "colorsJfa" ? jfaOutline : coloredOutline,
      visibility: peerVisibility
    });
  }
}
setPeerRenderingMode("overlays");

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
  // line - switch "selection technique" below to "colored outline" to see
  // this one (and everything else) rendered via ColoredOutlinePass's
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
hintRow.description = "Selection Technique below switches between \"outline\" (per-object, x-ray-capable) " +
  "and \"colored outline\" (postprocess, always fully visible) - see each control's own description for " +
  "specifics, and this file's comments for the deeper why.";
infoFolder.element.append(hintRow);

/**
 * Global selection technique, switchable at runtime - forces every id to
 * match (register's per-id `technique` only lasts until the next
 * setTechnique call). A group (e.g. "Cluster" here) always stays a
 * `SelectionBoundingBox` regardless of this setting, "coloredOutline"
 * included - see `SelectionManager`'s own doc comment for why. Its
 * individual parts are ordinary meshes though, so they follow this setting
 * like anything else - pick one directly in the 3D view (not the "Cluster"
 * outliner node) to try colored outline on it.
 */
const techniqueSettings = { technique: selectionManager.technique };
infoFolder
  .addBinding(techniqueSettings, "technique", {
    label: "selection technique",
    options: {
      outline: "outline",
      "colored outline (postprocess)": "coloredOutline"
    } satisfies Record<string, SelectionTechnique>
  })
  .on("change", ({ value }) => {
    selectionManager.setTechnique(value);

    // Keeps "Peer rendering" mode in sync both ways - see `setPeerRenderingMode`'s
    // own doc comment for why this is an enforced invariant, not just a
    // default. Preserves "colorsJfa" over "colors" if that's already chosen -
    // both already imply `"coloredOutline"`, so there's nothing to fix there.
    let pairedPeerMode: PeerRenderingMode = "overlays";
    if (value === "coloredOutline") {
      pairedPeerMode = peerRenderingMode === "colorsJfa" ? "colorsJfa" : "colors";
    }
    if (pairedPeerMode !== peerRenderingMode) {
      setPeerRenderingMode(pairedPeerMode);
      peerModeSettings.mode = pairedPeerMode;
      peerFolder.refresh();
    }
    updateControlAvailability();
  });

/**
 * Colors for the "selected" and "hover" overlays, independent of selection
 * technique - every setter here rebuilds/recolors the active overlay(s) in
 * place, so dragging a color swatch previews live on whatever is currently
 * selected/hovered. Only affects the "outline"/`SelectionBoundingBox`
 * per-object overlays - a `"coloredOutline"`-technique selection instead
 * reads `selectionManager.color`/`hoverColor` live through
 * `PeerColoredOutlinePass` (see its own doc comment), so these still apply
 * once "selection technique" is switched to "coloredOutline", just via a
 * different path.
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
 * SelectionOutline tuning, applied to every mesh currently rendered with
 * the "outline" technique - see `setOutlineOptions` on `SelectionManager`.
 * Rebuilds the active selection/hover overlays immediately, same as the
 * "selection technique" dropdown above.
 */
const outlineSettings = { linewidth: 1 };
infoFolder
  .addBinding(outlineSettings, "linewidth", { label: "outline width", min: 1, max: 10, step: 1 })
  .on("change", ({ value }) => selectionManager.setOutlineOptions({ linewidth: value }));

/**
 * `SelectionBoundingBox` tuning, applied to a group (e.g. "Cluster") whenever
 * it's selected/hovered as a whole - see `setBoundingBoxOptions` on
 * `SelectionManager`. `0` (the default) draws no fill mesh at all, matching
 * this class's prior wireframe-only behavior; try selecting "Cluster" from
 * the outliner and raising this to see the tinted volume appear.
 */
const boundingBoxSettings = { fillOpacity: 0 };
infoFolder
  .addBinding(boundingBoxSettings, "fillOpacity", { label: "group fill opacity", min: 0, max: 1, step: 0.05 })
  .on("change", ({ value }) => selectionManager.setBoundingBoxOptions({ fillOpacity: value }));

/**
 * X-ray only applies to the "outline" selection technique's own overlays
 * (`SelectionManager.xray`, see its own doc comment) - never "colored
 * outline", which has no occlusion concept to gate at all: every entry's
 * ring always draws fully regardless of what's in front of it (see
 * `ColoredOutlinePass`'s own doc comment for why). See "Peer rendering"
 * below for the equivalent local/peer split on the colored-outline side.
 */
const xraySettings = { xray: selectionManager.xray };
const xrayBinding = infoFolder
  .addBinding(xraySettings, "xray", { label: "x-ray (\"outline\" technique only)" })
  .on("change", ({ value }) => selectionManager.setXray(value));

function refreshStatus(): void {
  status.hovered = hovered?.name ?? "-";
  status.selected = selectionManager.selected ? (displayNames.get(selectionManager.selected) ?? selectionManager.selected) : "-";
  infoFolder.refresh();
}

const peerFolder = pane.addFolder({ title: "Peer rendering" });

// Explicit annotation: without it, TS narrows this object literal's `mode`
// to the literal `"overlays"` (control-flow narrowing a `let` read, unlike
// `selectionManager.technique` above which is a getter call), which the
// `satisfies Record<string, PeerRenderingMode>` binding below would then
// reject.
const peerModeSettings: { mode: PeerRenderingMode; } = { mode: peerRenderingMode };
peerFolder
  .addBinding(peerModeSettings, "mode", {
    label: "mode",
    options: {
      "overlays (per-object)": "overlays",
      "colors (postprocess, priority)": "colors",
      "colors (JFA prototype)": "colorsJfa"
    } satisfies Record<string, PeerRenderingMode>
  })
  .on("change", ({ value }) => {
    setPeerRenderingMode(value);

    // Keeps "selection technique" in sync both ways - see this mode's own
    // doc comment for why. "overlays" forces "outline"; "colors"/"colorsJfa"
    // both force "coloredOutline".
    const pairedTechnique: SelectionTechnique = value === "overlays" ? "outline" : "coloredOutline";
    if (pairedTechnique !== selectionManager.technique) {
      selectionManager.setTechnique(pairedTechnique);
      techniqueSettings.technique = pairedTechnique;
      infoFolder.refresh();
    }
    updateControlAvailability();
  });

// The local selection is always a `priority` entry, and both "colors" and
// "colors (JFA prototype)" honor it the same way - see `ColoredOutlinePass`'s
// and `JumpFloodOutlinePass`'s own doc comments on their (matching)
// priority-only mask/seed chains.
const priorityHintRow = document.createElement("jolly-property-row");
priorityHintRow.description = "Both \"colors\" modes make your own selection win any on-screen overlap " +
  "with a peer's, regardless of depth.";
peerFolder.element.append(priorityHintRow);

/**
 * `ColoredOutlinePass` tuning, applied whenever "Peer rendering" is on
 * "colors" (regardless of "selection technique", since `PeerColoredOutlinePass`
 * always includes the local selection too - see its own doc comment).
 * `edgeThickness` is this technique's equivalent of the "outline" technique's
 * own "outline width" setting (in the "Selection" folder). No hidden-opacity/
 * x-ray equivalent here - every ring always draws at full strength
 * regardless of real scene occlusion, see `ColoredOutlinePass`'s own doc
 * comment for why.
 */
const coloredOutlineSettings = { edgeThickness: coloredOutline.edgeThickness };
const edgeThicknessBinding = peerFolder
  .addBinding(coloredOutlineSettings, "edgeThickness", { label: "colored outline edge thickness", min: 1, max: 10, step: 1 })
  .on("change", ({ value }) => coloredOutline.setEdgeThickness(value));

/**
 * `JumpFloodOutlinePass` tuning, applied whenever "Peer rendering" is on
 * "colors (JFA prototype)". `ringThickness` is an exact pixel count (not a
 * blur-kernel radius like `edgeThickness` above) - the whole point of this
 * research prototype is that its ring reads the same width everywhere,
 * regardless of downsample level or viewing angle. See `JumpFloodOutlinePass`'s
 * own doc comment for what this prototype deliberately doesn't support yet
 * (priority, instancing).
 */
const jfaOutlineSettings = { ringThickness: jfaOutline.ringThickness };
const ringThicknessBinding = peerFolder
  .addBinding(jfaOutlineSettings, "ringThickness", { label: "JFA ring thickness (px)", min: 1, max: 10, step: 1 })
  .on("change", ({ value }) => jfaOutline.setRingThickness(value));

/**
 * Reflects which controls actually do anything under the current
 * technique/mode combo, rather than leaving that to label text alone -
 * called once here for the initial state, and again from both the
 * "selection technique" and "Peer rendering" mode handlers above whenever
 * either changes (including indirectly, via the sync between them).
 */
function updateControlAvailability(): void {
  xrayBinding.disabled = selectionManager.technique !== "outline";
  edgeThicknessBinding.disabled = peerRenderingMode !== "colors";
  ringThicknessBinding.disabled = peerRenderingMode !== "colorsJfa";
}
updateControlAvailability();

const visibilityHintRow = document.createElement("jolly-property-row");
visibilityHintRow.description = "\"max distance\" caps how far a peer selection's ring/chips render before " +
  "disappearing - never affects your own selection.";
peerFolder.element.append(visibilityHintRow);

const visibilitySettings = { maxDistance: 30 };
peerFolder
  .addBinding(visibilitySettings, "maxDistance", { label: "max distance", min: 0, max: 30, step: 1 })
  .on("change", ({ value }) => {
    peerVisibility.setMaxDistance(value);
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
  // `coloredOutline`/`jfaOutline` each own a full `RenderPipeline`, so one is
  // only used as the frame's render call while it's actually driving
  // anything (its own matching "Peer rendering" mode) - every other frame
  // renders normally.
  render: () => {
    if (peerRenderingMode === "colors") {
      coloredOutline.render();
    }
    else if (peerRenderingMode === "colorsJfa") {
      jfaOutline.render();
    }
    else {
      renderer.render(scene, camera);
    }
  }
});
