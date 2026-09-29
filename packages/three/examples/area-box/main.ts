// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import {
  ColorPalette,
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
  BoxControls,
  Grid,
  type Axis,
  type BoxAxisPolicy,
  type BoxFlipPolicy,
  type AreaBoxOptions
} from "../../src/index.ts";
import {
  createExample,
  orbitCamera
} from "../shared/example.ts";
import { pointerNdc } from "../shared/pointer.ts";

// CONSTANTS
const kSnapOptions: Record<string, number> = {
  "1 unit": 1,
  "half unit": 0.5,
  "4 units": 4,
  Free: 0
};
const kAxisOptions: Record<string, BoxAxisPolicy> = {
  "Ground (XZ)": "xz",
  "Volume (XYZ)": "xyz"
};
const kFlipOptions: Record<string, BoxFlipPolicy> = {
  None: "none",
  "Ground (XZ)": "xz",
  "Volume (XYZ)": "xyz"
};
const kPivotOptions: Record<string, PivotMode> = {
  Center: "center",
  "Min corner": "corner"
};
const kUp = new THREE.Vector3(0, 1, 0);
const kBounds = new THREE.Box3(
  new THREE.Vector3(-16, 0, -16),
  new THREE.Vector3(16, 8, 16)
);
const kPalette = new ColorPalette();
const kExtentRange = { min: 1, max: 24, step: 1 };
const kCoordRange = { min: -20, max: 20, step: 1 };
const kOpacityRange = { min: 0, max: 1, step: 0.05 };
const kEdgeWidthRange = { min: 1, max: 6, step: 1 };
const kLabelWidth = "13ch";

type PivotMode = "center" | "corner";

const {
  canvas,
  scene,
  camera,
  controls: orbit,
  pane,
  start
} = await createExample({
  title: "Area Box",
  background: "#12181d",
  camera: orbitCamera(
    { x: 14, y: 14, z: 18 },
    { x: 0, y: 0, z: 0 }
  )
});

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

const controls = new BoxControls<AreaBox>(camera, canvas, {
  snap: 1,
  moveAxes: "xyz",
  resizeAxes: "xz",
  rotateAxes: "y",
  flipAxes: "xz"
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
  if (controls.box === area) {
    controls.detach();
  }

  areas.splice(areas.indexOf(area), 1);
  scene.remove(area);
  area.dispose();
}

const settings = {
  snap: 1,
  moveAxes: "xyz" as BoxAxisPolicy,
  resizeAxes: "xz" as BoxAxisPolicy,
  rotate: true,
  flipAxes: "xz" as BoxFlipPolicy,
  pivot: "center" as PivotMode,
  bounded: false
};
const readout = {
  selection: "none",
  min: "-",
  size: "-"
};

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
  const { box: area } = controls;
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

    const { box: area } = controls;
    if (area !== null) {
      controls.detach();
      select(area);
    }
  });
interactionFolder
  .addBinding(settings, "rotate", { label: "Rotate" })
  .on("change", ({ value }) => {
    controls.rotateAxes = value ? "y" : "none";
  });
interactionFolder
  .addBinding(settings, "flipAxes", {
    options: kFlipOptions,
    label: "Flip axes"
  })
  .on("change", ({ value }) => {
    controls.flipAxes = value;
  });
interactionFolder
  .addBinding(settings, "pivot", {
    options: kPivotOptions,
    label: "Pivot"
  })
  .on("change", syncPivot);
interactionFolder
  .addBinding(settings, "bounded", { label: "Clamp to bounds" })
  .on("change", ({ value }) => {
    controls.bounds = value ? kBounds : null;
  });

function createAreaDialog() {
  const draft = {
    displayName: "Area",
    color: withAlpha(paletteColor(0), AreaBox.Defaults.opacity),
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
      color: fill === null ? paletteColor(0) : formatHex(fill),
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
        paletteColor(createdCount),
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
  const { box: area } = controls;
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

  syncPivot();
  refreshReadout();
}

function syncPivot(): void {
  const { box: area } = controls;
  controls.pivot = settings.pivot === "corner" && area !== null
    ? area.position.clone()
    : null;
}

function pivotOf(
  area: AreaBox
): THREE.Vector3 {
  return controls.pivot?.clone() ??
    area.toBox3().getCenter(new THREE.Vector3());
}

function snapToGrid(
  box: THREE.Box3
): THREE.Box3 {
  if (settings.snap > 0) {
    for (const point of [box.min, box.max]) {
      point.divideScalar(settings.snap).round().multiplyScalar(settings.snap);
    }
  }

  return box;
}

function turnArea(
  area: AreaBox,
  turns: number
): void {
  const pivot = pivotOf(area);
  const { min, max } = area.toBox3();
  const corners = [min, max].map((corner) => corner
    .sub(pivot)
    .applyAxisAngle(kUp, turns * Math.PI / 2)
    .add(pivot)
  );

  area.fromBox3(snapToGrid(new THREE.Box3().setFromPoints(corners)));
}

function mirrorArea(
  area: AreaBox,
  axis: Axis
): void {
  const pivot = pivotOf(area);
  const box = area.toBox3();
  const min = (pivot[axis] * 2) - box.max[axis];
  const max = (pivot[axis] * 2) - box.min[axis];
  box.min[axis] = min;
  box.max[axis] = max;

  area.fromBox3(snapToGrid(box));
}

const raycaster = new THREE.Raycaster();

canvas.addEventListener("pointerdown", (event) => {
  if (event.button !== 0 || controls.isOverHandle(event)) {
    return;
  }

  raycaster.setFromCamera(
    pointerNdc(canvas, event),
    camera
  );

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
  syncPivot();
  refreshReadout();
});
controls.addEventListener("rotate", ({ turns }) => {
  if (controls.box !== null) {
    turnArea(controls.box, turns);
    refreshReadout();
  }
});
controls.addEventListener("flip", ({ axis }) => {
  if (controls.box !== null) {
    mirrorArea(controls.box, axis);
    refreshReadout();
  }
});
controls.addEventListener("change", refreshReadout);

select(addArea({
  displayName: "Spawn",
  color: paletteColor(0),
  position: { x: -2, y: 0, z: -2 },
  size: { x: 6, y: 1, z: 4 }
}));

start();

function paletteColor(
  index: number
): string {
  return kPalette.colors[index % kPalette.colors.length];
}

function withAlpha(
  hex: string,
  alpha: number
): string {
  const color = parseColor(hex);

  return color === null ? hex : formatHex({ ...color, a: alpha }, true);
}
