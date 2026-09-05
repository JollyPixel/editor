// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import {
  formatHex,
  parseColor
} from "@jolly-pixel/color";
import {
  Pane,
  formatVector,
  type Dialog
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  AreaBox,
  AreaBoxControls,
  Grid,
  type AreaAxisPolicy,
  type AreaBoxOptions
} from "../../src/index.ts";
import {
  createRenderer,
  createScene,
  createOrbitCamera,
  startLoop
} from "./utils/common.ts";
import { createExamplePane } from "./utils/example-switcher.ts";
import { mountPerformanceStats } from "./utils/performance-stats.ts";

// CONSTANTS
const kSnapOptions: Record<string, number> = {
  "1 unit": 1,
  "half unit": 0.5,
  "4 units": 4,
  Free: 0
};
const kAxisOptions: Record<string, AreaAxisPolicy> = {
  "Ground (XZ)": "xz",
  "Volume (XYZ)": "xyz"
};
const kBounds = new THREE.Box3(
  new THREE.Vector3(-16, 0, -16),
  new THREE.Vector3(16, 8, 16)
);
const kPalette = ["#4da3ff", "#f4a261", "#8ecf72", "#c792ea", "#f28ab2"];
const kExtentRange = { min: 1, max: 24, step: 1 };
const kCoordRange = { min: -20, max: 20, step: 1 };
const kOpacityRange = { min: 0, max: 1, step: 0.05 };
const kEdgeWidthRange = { min: 1, max: 6, step: 1 };
const kLabelWidth = "13ch";

const canvas = document.querySelector("canvas") as HTMLCanvasElement;
const renderer = await createRenderer(canvas);

const scene = createScene("#12181d");
scene.add(new Grid({
  cell: {
    style: "cross",
    size: 1
  },
  section: {
    size: 12,
    color: "#393939"
  },
  fade: {
    distance: 50
  },
  axes: {
    show: false
  },
  hideCellOnSection: true
}));

const { camera, controls: orbit } = createOrbitCamera(
  canvas,
  { x: 14, y: 14, z: 18 },
  { x: 0, y: 0, z: 0 }
);

const controls = new AreaBoxControls(camera, canvas, {
  snap: 1,
  moveAxes: "xyz",
  resizeAxes: "xz"
});

const areas: AreaBox[] = [];
let createdCount = 0;

function addArea(
  options: AreaBoxOptions
): AreaBox {
  const area = new AreaBox(options);
  scene.add(area);
  areas.push(area);
  createdCount++;

  return area;
}

function removeArea(
  area: AreaBox
): void {
  if (controls.area === area) {
    controls.detach();
  }

  areas.splice(areas.indexOf(area), 1);
  scene.remove(area);
  area.dispose();
}

const settings = {
  snap: 1,
  moveAxes: "xyz" as AreaAxisPolicy,
  resizeAxes: "xz" as AreaAxisPolicy,
  bounded: false
};
const readout = {
  selection: "none",
  min: "-",
  size: "-"
};

const pane = createExamplePane({
  title: "Area Box"
});
const performanceStats = mountPerformanceStats(renderer);

const selectionFolder = pane.addFolder({
  title: "Selection"
});
selectionFolder.addMonitor(readout, "selection", { label: "Area" });
selectionFolder.addMonitor(readout, "min", { label: "Min corner" });
selectionFolder.addMonitor(readout, "size", { label: "Size" });

const areasFolder = pane.addFolder({
  title: "Areas"
});
areasFolder
  .addButton({ title: "Add area…" })
  .on("click", () => areaDialog.open());
const removeButton = areasFolder.addButton({ title: "Remove selected" });
removeButton.on("click", () => {
  const { area } = controls;
  if (area !== null) {
    removeArea(area);
    select(null);
  }
});

const interactionFolder = pane.addFolder({
  title: "Interaction"
});
interactionFolder
  .addBinding(settings, "snap", { options: kSnapOptions })
  .on("change", ({ value }) => {
    controls.snap = value === 0 ? null : value;
  });
interactionFolder
  .addBinding(settings, "moveAxes", {
    options: kAxisOptions,
    label: "Move axes"
  })
  .on("change", ({ value }) => {
    controls.moveAxes = value;
  });
interactionFolder
  .addBinding(settings, "resizeAxes", {
    options: kAxisOptions,
    label: "Resize axes"
  })
  .on("change", ({ value }) => {
    controls.resizeAxes = value;
    // Re-attaching applies the policy to the arrows already in the scene.
    const { area } = controls;
    if (area !== null) {
      controls.detach();
      select(area);
    }
  });
interactionFolder
  .addBinding(settings, "bounded", { label: "Clamp to bounds" })
  .on("change", ({ value }) => {
    controls.bounds = value ? kBounds : null;
  });

function createAreaDialog() {
  const draft = {
    displayName: "Area",
    color: withAlpha(kPalette[0], AreaBox.Defaults.opacity),
    position: { x: 0, y: 0, z: 0 },
    size: { x: 4, y: 1, z: 4 },
    edgeOpacity: AreaBox.Defaults.edges.opacity,
    edgeWidth: AreaBox.Defaults.edges.width,
    showEdges: AreaBox.Defaults.edges.show,
    shadeFaces: AreaBox.Defaults.shadeFaces
  };

  const dialog = document.createElement("jolly-dialog") as Dialog;
  dialog.heading = "New area";
  document.body.append(dialog);

  const form = new Pane({
    container: dialog,
    grow: false,
    labelWidth: kLabelWidth
  });
  form.addBinding(draft, "displayName", { label: "Name" });
  form.addBinding(draft, "color", { label: "Color" });
  form.addSeparator();
  form.addBinding(draft, "position", {
    label: "Min corner",
    ...kCoordRange
  });
  form.addBinding(draft, "size", {
    label: "Size",
    ...kExtentRange
  });
  form.addSeparator();
  form.addBinding(draft, "edgeOpacity", {
    ...kOpacityRange,
    label: "Edge opacity"
  });
  form.addBinding(draft, "edgeWidth", {
    ...kEdgeWidthRange,
    label: "Edge width"
  });
  form.addBinding(draft, "showEdges", { label: "Show edges" });
  form.addBinding(draft, "shadeFaces", { label: "Shade faces" });

  const cancel = document.createElement("jolly-button");
  cancel.slot = "actions";
  cancel.textContent = "Cancel";
  cancel.addEventListener("click", () => dialog.close());

  const confirm = document.createElement("jolly-button");
  confirm.slot = "actions";
  confirm.variant = "accent";
  confirm.textContent = "Create";
  confirm.addEventListener("click", () => {
    const fill = parseColor(draft.color);
    const area = addArea({
      displayName: draft.displayName,
      color: fill === null ? kPalette[0] : formatHex(fill),
      position: draft.position,
      size: draft.size,
      opacity: fill === null ? AreaBox.Defaults.opacity : fill.a,
      edges: {
        show: draft.showEdges,
        width: draft.edgeWidth,
        opacity: draft.edgeOpacity
      },
      shadeFaces: draft.shadeFaces
    });
    dialog.close();
    select(area);
  });

  dialog.append(cancel, confirm);

  return {
    open(): void {
      draft.displayName = `Area ${createdCount + 1}`;
      draft.color = withAlpha(
        kPalette[createdCount % kPalette.length],
        AreaBox.Defaults.opacity
      );
      draft.position = {
        x: (createdCount % 3) * 6,
        y: 0,
        z: Math.floor(createdCount / 3) * 6
      };
      draft.size = { x: 4, y: 1, z: 4 };
      form.refresh();
      dialog.showModal();
    }
  };
}

const areaDialog = createAreaDialog();

function refreshReadout(): void {
  const { area } = controls;
  if (area === null) {
    readout.selection = "none";
    readout.min = "-";
    readout.size = "-";
  }
  else {
    readout.selection = area.label?.displayName ?? "area";
    readout.min = formatVector(area.position);
    readout.size = formatVector(area.size);
  }

  removeButton.disabled = area === null;
  pane.refresh();
}

function select(
  area: AreaBox | null,
  from?: PointerEvent
): void {
  if (area === null) {
    controls.detach();
  }
  else {
    controls.attach(area, { from });
  }

  refreshReadout();
}

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

canvas.addEventListener("pointerdown", (event) => {
  if (event.button !== 0 || controls.isOverHandle(event)) {
    return;
  }

  const rect = canvas.getBoundingClientRect();
  pointer.set(
    (((event.clientX - rect.left) / rect.width) * 2) - 1,
    (-((event.clientY - rect.top) / rect.height) * 2) + 1
  );
  raycaster.setFromCamera(pointer, camera);

  const hits = raycaster.intersectObjects(
    areas.map((area) => area.fill),
    false
  );
  select(
    hits.length > 0
      ? areas.find((area) => area.fill === hits[0].object) ?? null
      : null,
    event
  );
}, true);

controls.addEventListener("start", () => {
  orbit.enabled = false;
});
controls.addEventListener("end", () => {
  orbit.enabled = true;
  refreshReadout();
});
controls.addEventListener("change", refreshReadout);

select(addArea({
  displayName: "Spawn",
  color: kPalette[0],
  position: { x: -2, y: 0, z: -2 },
  size: { x: 6, y: 1, z: 4 }
}));

startLoop({
  renderer,
  scene,
  camera,
  controls: orbit,
  onBeforeRender: () => performanceStats.begin(),
  onAfterRender: () => performanceStats.end()
});

function withAlpha(
  hex: string,
  alpha: number
): string {
  const channel = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, "0");

  return `${hex}${channel}`;
}
