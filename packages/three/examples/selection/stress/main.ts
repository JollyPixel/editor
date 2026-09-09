// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import {
  SelectionManager,
  HighlightPass,
  HighlightPassJfa,
  PeerSelectionRegistry,
  MergedSelectionOverlay,
  type HighlightEntry
} from "../../../src/index.ts";
import {
  createExample,
  orbitCamera
} from "../../shared/example.ts";
import { onCanvasPick } from "../shared/pointer-picking.ts";
import { addSelectionLighting } from "../shared/selectables.ts";
import { InstanceGrid } from "./InstanceGrid.ts";
import { InstanceSelection } from "./InstanceSelection.ts";
import { SimulatedPeers } from "./SimulatedPeers.ts";

// CONSTANTS
const kDefaultInstanceCount = 100;
const kMaxInstanceCount = 3000;
const kOutlineSelectionCap = 100;

type RenderMode = "outline" | "peerColors" | "peerColorsJfa";

const {
  canvas,
  renderer,
  scene,
  camera,
  pane,
  start
} = await createExample({
  title: "Stress",
  background: "#101018",
  camera: orbitCamera(
    { x: 14, y: 12, z: 18 },
    { x: 0, y: 0, z: 0 }
  )
});

addSelectionLighting(scene);
camera.far = 500;
camera.updateProjectionMatrix();

const selectionManager = new SelectionManager();
const highlight = new HighlightPass(renderer, scene, camera);
const highlightJfa = new HighlightPassJfa(renderer, scene, camera);
const peerRegistry = new PeerSelectionRegistry();
const peers = new SimulatedPeers(peerRegistry);

const grid = new InstanceGrid(
  new THREE.TorusKnotGeometry(0.6, 0.22, 128, 24),
  new THREE.MeshStandardMaterial({ color: "#4a90d9" }),
  kMaxInstanceCount
);
scene.add(grid.mesh);

const selection = new InstanceSelection(grid);

let renderMode: RenderMode = "outline";
let selectionOverlay: MergedSelectionOverlay | null = null;
let hoverOverlay: MergedSelectionOverlay | null = null;

function refreshHighlightEntries(): void {
  const { appearance } = selectionManager;
  const entries: HighlightEntry[] = selection.selected.map((instanceId) => {
    return {
      target: grid.mesh,
      instanceId,
      color: appearance.selected.color,
      priority: true
    };
  });

  const { hovered } = selection;
  if (hovered !== null) {
    entries.push({
      target: grid.mesh,
      instanceId: hovered,
      color: appearance.hovered.color
    });
  }

  const taken = new Set(selection.selected);
  for (const objectId of peerRegistry.selectedObjectIds()) {
    const instanceId = Number(objectId);
    if (taken.has(instanceId) || instanceId === hovered) {
      continue;
    }

    const peerId = peerRegistry.primarySelectorOf(objectId);
    if (peerId === null) {
      continue;
    }

    entries.push({
      target: grid.mesh,
      instanceId,
      color: peerRegistry.colorOf(peerId)
    });
  }

  highlight.entries = entries;
  highlightJfa.entries = entries;
}

function rebuildOverlays(): void {
  selectionOverlay?.dispose();
  selectionOverlay = null;
  hoverOverlay?.dispose();
  hoverOverlay = null;

  if (renderMode === "outline") {
    const { appearance } = selectionManager;
    const { hovered } = selection;

    if (hovered !== null) {
      hoverOverlay = new MergedSelectionOverlay({
        parent: scene,
        targets: [grid.proxyMesh(hovered)],
        color: appearance.hovered.color,
        opacity: appearance.hovered.opacity,
        linewidth: appearance.outline.linewidth,
        xray: appearance.xray
      });
    }
    if (selection.selected.length > 0) {
      selectionOverlay = new MergedSelectionOverlay({
        parent: scene,
        targets: selection.selected.map((id) => grid.proxyMesh(id)),
        color: appearance.selected.color,
        opacity: 1,
        linewidth: appearance.outline.linewidth,
        xray: true
      });
    }
  }

  refreshHighlightEntries();
}

function spawnInstances(
  count: number
): void {
  selection.clear();
  peers.clear();
  grid.spawn(count);
  rebuildOverlays();
}

function clusterPeersAroundSelection(
  peerCount: number
): void {
  if (grid.count === 0) {
    return;
  }

  if (selection.anchorId === null) {
    const [centerId] = grid.nearestIds(new THREE.Vector3(), 1);
    if (centerId === undefined) {
      return;
    }

    selection.select(centerId);
    rebuildOverlays();
  }

  const anchorId = selection.anchorId;
  if (anchorId === null) {
    return;
  }

  peers.assign(
    grid.nearestIds(grid.positionOf(anchorId), peerCount, anchorId)
  );
}

peerRegistry.addEventListener("peerSelectionChange", refreshHighlightEntries);

onCanvasPick(canvas, {
  camera,
  pick: (raycaster) => {
    const [hit] = raycaster.intersectObject(grid.mesh, false);

    return hit?.instanceId ?? null;
  },
  onHover: (instanceId) => {
    if (selection.hover(instanceId)) {
      rebuildOverlays();
    }
  },
  onClick: (instanceId) => {
    selection.select(instanceId);
    rebuildOverlays();
  }
});

spawnInstances(kDefaultInstanceCount);

const stressFolder = pane.addFolder({ title: "Stress Test" });
const stressSettings = { instanceCount: kDefaultInstanceCount };
stressFolder
  .addBinding(stressSettings, "instanceCount", {
    label: "instances",
    min: 1,
    max: kMaxInstanceCount,
    step: 1
  })
  .on("change", ({ value, last }) => {
    if (last) {
      spawnInstances(Math.round(value));
      syncCountLimits();
    }
  });

const selectionFolder = pane.addFolder({ title: "Selection" });

const perfHintRow = document.createElement("jolly-property-row");
perfHintRow.label = "perf note";
perfHintRow.description = "\"outline\" re-merges geometry on every change and is local-only, so its own " +
  "\"count\" caps lower below; both \"peer colors\" modes never rebuild geometry, stay uncapped, and are the " +
  "only modes where peers are visible.";
selectionFolder.element.append(perfHintRow);

const modeSettings: { mode: RenderMode; } = { mode: renderMode };
selectionFolder
  .addBinding(modeSettings, "mode", {
    label: "mode",
    options: {
      outline: "outline",
      "peer colors (blur)": "peerColors",
      "peer colors (JFA)": "peerColorsJfa"
    } satisfies Record<string, RenderMode>
  })
  .on("change", ({ value }) => {
    renderMode = value;
    syncCountLimits();
    rebuildOverlays();
    updateControlVisibility();
  });

const xraySettings = { xray: selectionManager.appearance.xray };
const xrayBinding = selectionFolder
  .addBinding(xraySettings, "xray", { label: "x-ray (hover)" })
  .on("change", ({ value }) => {
    selectionManager.configure({ xray: value });
    rebuildOverlays();
  });

const randomFolder = pane.addFolder({ title: "Random Selection" });
const randomSettings = { count: 0 };
const randomCountBinding = randomFolder
  .addBinding(randomSettings, "count", {
    label: "count",
    min: 0,
    max: randomSelectionMax(),
    step: 1
  })
  .on("change", ({ last }) => {
    if (last) {
      randomizeSelection();
    }
  });
randomFolder.addButton({ title: "Randomize" }).on("click", () => {
  randomizeSelection();
});
randomFolder.addButton({ title: "Clear" }).on("click", () => {
  selection.select(null);
  rebuildOverlays();
});

const peerColorsFolder = pane.addFolder({ title: "Peer Colors" });
const peerColorsSettings = { peerCount: 4 };
const peerCountBinding = peerColorsFolder
  .addBinding(peerColorsSettings, "peerCount", {
    label: "peer count",
    min: 0,
    max: grid.count,
    step: 1
  })
  .on("change", ({ value, last }) => {
    if (last) {
      peers.assign(grid.randomIds(Math.round(value)));
    }
  });
peerColorsFolder.addButton({ title: "Randomize assignment" }).on("click", () => {
  peers.assign(grid.randomIds(Math.round(peerColorsSettings.peerCount)));
});

const clusterHintRow = document.createElement("jolly-property-row");
clusterHintRow.description = "Packs peers tightly around your selection to stress the priority guarantee.";
peerColorsFolder.element.append(clusterHintRow);
peerColorsFolder.addButton({ title: "Cluster around selection" }).on("click", () => {
  clusterPeersAroundSelection(Math.round(peerColorsSettings.peerCount));
});

const highlightSettings = { edgeThickness: highlight.edgeThickness };
const edgeThicknessBinding = peerColorsFolder
  .addBinding(highlightSettings, "edgeThickness", { label: "blur edge thickness", min: 1, max: 10, step: 1 })
  .on("change", ({ value }) => {
    highlight.edgeThickness = value;
  });

const highlightJfaSettings = { ringThickness: highlightJfa.ringThickness };
const ringThicknessBinding = peerColorsFolder
  .addBinding(highlightJfaSettings, "ringThickness", { label: "JFA ring thickness (px)", min: 1, max: 10, step: 1 })
  .on("change", ({ value }) => {
    highlightJfa.ringThickness = value;
  });

function randomizeSelection(): void {
  selection.randomize(Math.round(randomSettings.count));
  rebuildOverlays();
}

function setSliderMax(
  binding: { element: HTMLElement; },
  max: number
): void {
  (binding.element as HTMLElementTagNameMap["jolly-slider"]).max = max;
}

function randomSelectionMax(): number {
  return renderMode === "outline" ?
    Math.min(grid.count, kOutlineSelectionCap) :
    grid.count;
}

function syncCountLimits(): void {
  const randomMax = randomSelectionMax();
  setSliderMax(randomCountBinding, randomMax);
  randomSettings.count = Math.min(randomSettings.count, randomMax);
  randomCountBinding.refresh();
  selection.truncate(randomMax);

  setSliderMax(peerCountBinding, grid.count);
  peerColorsSettings.peerCount = Math.min(peerColorsSettings.peerCount, grid.count);
  peerCountBinding.refresh();
}

function updateControlVisibility(): void {
  xrayBinding.hidden = renderMode !== "outline";
  edgeThicknessBinding.hidden = renderMode !== "peerColors";
  ringThicknessBinding.hidden = renderMode !== "peerColorsJfa";
}

updateControlVisibility();

start({
  render: () => {
    if (renderMode === "peerColors") {
      highlight.render();
    }
    else if (renderMode === "peerColorsJfa") {
      highlightJfa.render();
    }
    else {
      renderer.render(scene, camera);
    }
  }
});
