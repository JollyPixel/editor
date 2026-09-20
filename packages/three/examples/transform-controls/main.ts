// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import {
  formatVector,
  type JollyChangeDetail,
  type JollyOption
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  Grid,
  TransformControls,
  type TransformDirectionPolicy,
  type TransformGizmoAppearanceOptions,
  type TransformHandle,
  type TransformMode,
  type TransformPivot,
  type TransformPlaneColorPolicy
} from "../../src/index.ts";
import {
  createExample,
  orbitCamera
} from "../shared/example.ts";

// CONSTANTS
const kModeOptions: JollyOption<TransformMode>[] = [
  {
    value: "translate",
    label: "Pos"
  },
  {
    value: "rotate",
    label: "Angle"
  },
  {
    value: "scale",
    label: "Scale"
  }
];
const kOrientationOptions: JollyOption<OrientationName>[] = [
  {
    value: "world",
    label: "Global"
  },
  {
    value: "local",
    label: "Local"
  },
  {
    value: "parent",
    label: "Parent"
  },
  {
    value: "view",
    label: "View"
  }
];
const kPivotOptions = {
  Origin: "origin",
  "Bottom corner": "corner",
  "Top face": "top",
  Custom: "custom"
} as const;
const kPivotPresets: Record<PivotPresetName, THREE.Vector3Like> = {
  origin: { x: 0, y: 0, z: 0 },
  corner: { x: -1, y: -1, z: -1 },
  top: { x: 0, y: 1, z: 0 }
};
const kTranslateSnapOptions: Record<string, number> = {
  "1 unit": 1,
  "half unit": 0.5,
  "4 units": 4,
  Free: 0
};
const kRotateSnapOptions: Record<string, number> = {
  "15 degrees": 15,
  "45 degrees": 45,
  "90 degrees": 90,
  Free: 0
};
const kScaleSnapOptions: Record<string, number> = {
  Quarter: 0.25,
  Half: 0.5,
  Free: 0
};
const kDirectionOptions: Record<string, TransformDirectionPolicy> = {
  Positive: "positive",
  Negative: "negative",
  Mirrored: "both"
};
const kShapeOptions = {
  Arrow: "arrow",
  Sphere: "sphere",
  Cube: "cube"
} as const;
const kOutlineWidthRange = { min: 0.5, max: 6, step: 0.5 };
const kSizeRange = { min: 0.04, max: 0.2, step: 0.005 };
const kGapRange = { min: 0, max: 0.4, step: 0.01 };
const kPlaneSizeRange = { min: 0.1, max: 0.8, step: 0.01 };
const kPlaneInsetRange = { min: 0, max: 1, step: 0.005 };
const kPlaneBorderRange = { min: 0, max: 0.1, step: 0.005 };
const kOpacityRange = { min: 0.1, max: 1, step: 0.05 };

type PivotName = typeof kPivotOptions[keyof typeof kPivotOptions];
type PivotPresetName = Exclude<PivotName, "custom">;
type OrientationName = "world" | "local" | "parent" | "view";
type ShapeName = typeof kShapeOptions[keyof typeof kShapeOptions];

interface ButtonGroupOptions<TValue> {
  label: string;
  options: JollyOption<TValue>[];
  value: TValue;
  change: (value: TValue) => void;
}

const {
  canvas,
  scene,
  camera,
  controls: orbit,
  pane,
  start
} = await createExample({
  title: "Transform Controls",
  background: "#161a21",
  camera: orbitCamera(
    { x: 8, y: 7, z: 10 },
    { x: 0, y: 1, z: 0 }
  )
});

scene.add(new Grid({
  cell: {
    style: "cross",
    size: 1
  },
  section: {
    size: 8,
    color: "#3c424b"
  },
  fade: {
    distance: 50
  },
  axes: {
    show: false
  },
  hideCellOnSection: true
}));

scene.add(
  new THREE.HemisphereLight("#dceaff", "#151820", 2.5),
  new THREE.DirectionalLight("#ffffff", 3)
);

const parent = new THREE.Group();
parent.rotation.y = Math.PI / 6;
scene.add(parent);

const target = new THREE.Mesh(
  new THREE.BoxGeometry(2, 2, 2),
  new THREE.MeshStandardMaterial({
    color: "#a7b0bf",
    roughness: 0.65
  })
);
target.position.set(0, 1, 0);
parent.add(target);

const pivotAnchor = new THREE.Object3D();
target.add(pivotAnchor);

const settings = {
  mode: "translate" as TransformMode,
  orientation: "world" as OrientationName,
  pivot: "origin" as PivotName,
  editPivot: false,
  values: {
    x: target.position.x,
    y: target.position.y,
    z: target.position.z
  },
  translateSnap: 1,
  rotateSnap: 15,
  scaleSnap: 0.25,
  enableX: true,
  enableY: true,
  enableZ: true,
  directions: "positive" as TransformDirectionPolicy,
  shape: "arrow" as ShapeName,
  scaleShape: "cube" as ShapeName,
  planes: true,
  planeSize: 0.3,
  planeInset: 0.125,
  planeOpacity: 0.3,
  planeBorder: 0.02,
  planeColor: "normal" as TransformPlaneColorPolicy,
  gap: 0,
  viewRing: true,
  frontOnly: true,
  center: true,
  centerColor: "#ffffff",
  pivotCenterColor: "#ffb020",
  hideAligned: false,
  flipTowardCamera: false,
  outline: true,
  outlineColor: "#080b11",
  outlineWidth: 2,
  size: 0.09
};
const readout = {
  position: formatVector(target.position),
  rotation: formatVector(degrees(target.rotation)),
  scale: formatVector(target.scale),
  state: "idle"
};

const statusFolder = pane.addFolder({ title: "Target" });
statusFolder.addMonitor(readout, "position", { label: "Position" });
statusFolder.addMonitor(readout, "rotation", { label: "Rotation" });
statusFolder.addMonitor(readout, "scale", { label: "Scale" });
statusFolder.addMonitor(readout, "state", { label: "Gesture" });

const transformFolder = pane.addFolder({ title: "Transform" });
const modeGroup = createButtonGroup({
  label: "Transform mode",
  options: kModeOptions,
  value: settings.mode,
  change: (value) => {
    settings.mode = value;
    transform.mode = value;
    showModeFolders();
    refreshReadout();
  }
});
const orientationGroup = createButtonGroup({
  label: "Transform orientation",
  options: kOrientationOptions,
  value: settings.orientation,
  change: (value) => {
    settings.orientation = value;
    transform.orientation = value;
  }
});
transformFolder.element.append(
  modeGroup,
  orientationGroup
);
transformFolder
  .addBinding(settings, "values", {
    step: 0.01,
    label: "Values"
  })
  .on("change", applyValues);
transformFolder
  .addBinding(settings, "pivot", {
    options: kPivotOptions,
    label: "Pivot"
  })
  .on("change", ({ value }) => {
    if (value !== "custom") {
      pivotAnchor.position.copy(kPivotPresets[value]);
    }
    applyPivot();
  });
transformFolder
  .addBinding(settings, "editPivot", { label: "Edit pivot" })
  .on("change", () => {
    rebuild();
    showModeFolders();
    refreshReadout();
  });

const translateFolder = pane.addFolder({ title: "Pos mode" });
translateFolder
  .addBinding(settings, "translateSnap", {
    options: kTranslateSnapOptions,
    label: "Snap"
  })
  .on("change", applySnap);
translateFolder
  .addBinding(settings, "shape", {
    options: kShapeOptions,
    label: "Handle"
  })
  .on("change", rebuild);

const rotateFolder = pane.addFolder({ title: "Angle mode" });
rotateFolder
  .addBinding(settings, "rotateSnap", {
    options: kRotateSnapOptions,
    label: "Snap"
  })
  .on("change", applySnap);
rotateFolder
  .addBinding(settings, "viewRing", { label: "View ring" })
  .on("change", rebuild);
rotateFolder
  .addBinding(settings, "frontOnly", { label: "Front only" })
  .on("change", rebuild);

const scaleFolder = pane.addFolder({ title: "Scale mode" });
scaleFolder
  .addBinding(settings, "scaleSnap", {
    options: kScaleSnapOptions,
    label: "Snap"
  })
  .on("change", applySnap);
scaleFolder
  .addBinding(settings, "scaleShape", {
    options: kShapeOptions,
    label: "Handle"
  })
  .on("change", rebuild);

const axisHandlesFolder = pane.addFolder({ title: "Pos and Scale handles" });
axisHandlesFolder
  .addBinding(settings, "directions", {
    options: kDirectionOptions,
    label: "Directions"
  })
  .on("change", rebuild);
axisHandlesFolder
  .addBinding(settings, "planes", { label: "Planes" })
  .on("change", rebuild);
axisHandlesFolder
  .addBinding(settings, "planeSize", {
    ...kPlaneSizeRange,
    label: "Plane size"
  })
  .on("change", rebuild);
axisHandlesFolder
  .addBinding(settings, "planeInset", {
    ...kPlaneInsetRange,
    label: "Plane inset"
  })
  .on("change", rebuild);
axisHandlesFolder
  .addBinding(settings, "planeOpacity", {
    ...kOpacityRange,
    label: "Plane opacity"
  })
  .on("change", rebuild);
axisHandlesFolder
  .addBinding(settings, "planeBorder", {
    ...kPlaneBorderRange,
    label: "Plane border"
  })
  .on("change", rebuild);
axisHandlesFolder
  .addBinding(settings, "planeColor", {
    label: "Plane color",
    options: {
      Normal: "normal",
      Blend: "blend"
    }
  })
  .on("change", rebuild);
axisHandlesFolder
  .addBinding(settings, "gap", {
    ...kGapRange,
    label: "Gap"
  })
  .on("change", rebuild);
axisHandlesFolder
  .addBinding(settings, "center", { label: "Center" })
  .on("change", rebuild);
axisHandlesFolder
  .addBinding(settings, "hideAligned", { label: "Hide aligned" })
  .on("change", rebuild);
axisHandlesFolder
  .addBinding(settings, "flipTowardCamera", { label: "Flip to camera" })
  .on("change", rebuild);

const gizmoFolder = pane.addFolder({ title: "Every mode" });
gizmoFolder
  .addBinding(settings, "enableX", { label: "X axis" })
  .on("change", applyAxes);
gizmoFolder
  .addBinding(settings, "enableY", { label: "Y axis" })
  .on("change", applyAxes);
gizmoFolder
  .addBinding(settings, "enableZ", { label: "Z axis" })
  .on("change", applyAxes);
gizmoFolder
  .addBinding(settings, "centerColor", { label: "Center color" })
  .on("change", rebuild);
gizmoFolder
  .addBinding(settings, "pivotCenterColor", { label: "Pivot color" })
  .on("change", rebuild);
gizmoFolder
  .addBinding(settings, "size", {
    ...kSizeRange,
    label: "Size"
  })
  .on("change", rebuild);
gizmoFolder
  .addBinding(settings, "outline", { label: "Outline" })
  .on("change", rebuild);
gizmoFolder
  .addBinding(settings, "outlineColor", { label: "Outline color" })
  .on("change", rebuild);
gizmoFolder
  .addBinding(settings, "outlineWidth", {
    ...kOutlineWidthRange,
    label: "Outline width"
  })
  .on("change", rebuild);

function showModeFolders(): void {
  const mode = activeMode();
  translateFolder.hidden = mode !== "translate";
  rotateFolder.hidden = mode !== "rotate";
  scaleFolder.hidden = mode !== "scale";
  axisHandlesFolder.hidden = mode === "rotate";
  modeGroup.toggleAttribute("disabled", settings.editPivot);
  orientationGroup.toggleAttribute("disabled", mode === "scale");
}

function activeMode(): TransformMode {
  return settings.editPivot ? "translate" : settings.mode;
}

function subject(): THREE.Object3D {
  return settings.editPivot ? pivotAnchor : target;
}

function resolvePivot(): TransformPivot {
  if (settings.pivot === "origin") {
    return "origin";
  }

  return settings.pivot === "custom"
    ? pivotAnchor
    : kPivotPresets[settings.pivot];
}

let transform = createTransformControls();

function appearance(): TransformGizmoAppearanceOptions {
  return {
    size: settings.size,
    gap: settings.gap,
    directions: settings.directions,
    handle: {
      kind: settings.shape
    },
    scaleHandle: {
      kind: settings.scaleShape
    },
    planes: settings.planes
      ? {
        size: settings.planeSize,
        inset: settings.planeInset,
        opacity: settings.planeOpacity,
        border: settings.planeBorder > 0 ? settings.planeBorder : false,
        color: settings.planeColor
      }
      : false,
    center: settings.center
      ? {
        interactive: true,
        color: settings.editPivot
          ? settings.pivotCenterColor
          : settings.centerColor
      }
      : false,
    viewRing: settings.viewRing ? {} : false,
    rings: {
      frontOnly: settings.frontOnly
    },
    hideAligned: settings.hideAligned,
    flipTowardCamera: settings.flipTowardCamera,
    outline: settings.outline
      ? {
        color: settings.outlineColor,
        width: settings.outlineWidth
      }
      : false
  };
}

function createTransformControls(): TransformControls {
  const controls = new TransformControls(camera, canvas, {
    mode: activeMode(),
    orientation: settings.orientation,
    pivot: settings.editPivot ? "origin" : resolvePivot(),
    appearance: appearance()
  });
  controls.attach(subject());
  controls.addEventListener("start", ({ mode, handle }) => {
    orbit.enabled = false;
    readout.state = `${mode} ${describeHandle(handle)}`;
    pane.refresh();
  });
  controls.addEventListener("change", () => {
    if (settings.editPivot) {
      settings.pivot = "custom";
    }
    refreshReadout();
  });
  controls.addEventListener("end", ({ cancelled }) => {
    orbit.enabled = true;
    readout.state = cancelled ? "cancelled" : "idle";
    pane.refresh();
  });
  scene.add(controls.helper);

  return controls;
}

function applyPivot(): void {
  transform.mode = activeMode();
  transform.pivot = settings.editPivot ? "origin" : resolvePivot();
  transform.attach(subject());
}

function applySnap(): void {
  transform.snap = {
    translate: settings.translateSnap === 0
      ? null
      : settings.translateSnap,
    rotate: settings.rotateSnap === 0
      ? null
      : THREE.MathUtils.degToRad(settings.rotateSnap),
    scale: settings.scaleSnap === 0 ? null : settings.scaleSnap
  };
}

function applyAxes(): void {
  transform.axes = {
    x: settings.enableX,
    y: settings.enableY,
    z: settings.enableZ
  };
}

function rebuild(): void {
  scene.remove(transform.helper);
  transform.dispose();
  transform = createTransformControls();
  applySnap();
  applyAxes();
}

function createButtonGroup<TValue>(
  options: ButtonGroupOptions<TValue>
): HTMLElement {
  const group = document.createElement("jolly-button-group");
  group.setAttribute("aria-label", options.label);
  group.options = options.options;
  group.value = options.value;
  group.addEventListener("jolly-change", (event) => {
    const { detail } = event as CustomEvent<JollyChangeDetail<TValue>>;
    group.value = detail.value;
    options.change(detail.value);
  });

  return group;
}

function applyValues(): void {
  const { x, y, z } = settings.values;
  if (settings.editPivot) {
    pivotAnchor.position.set(x, y, z);
    settings.pivot = "custom";
  }
  else if (settings.mode === "translate") {
    target.position.set(x, y, z);
  }
  else if (settings.mode === "rotate") {
    target.rotation.set(
      THREE.MathUtils.degToRad(x),
      THREE.MathUtils.degToRad(y),
      THREE.MathUtils.degToRad(z)
    );
  }
  else {
    target.scale.set(x, y, z);
  }
  refreshReadout();
}

function modeValues(): THREE.Vector3Like {
  if (settings.editPivot) {
    return pivotAnchor.position;
  }
  if (settings.mode === "translate") {
    return target.position;
  }

  return settings.mode === "rotate"
    ? degrees(target.rotation)
    : target.scale;
}

function refreshReadout(): void {
  const { x, y, z } = modeValues();
  settings.values = {
    x: round(x),
    y: round(y),
    z: round(z)
  };
  readout.position = formatVector(target.position);
  readout.rotation = formatVector(degrees(target.rotation));
  readout.scale = formatVector(target.scale);
  pane.refresh();
}

function describeHandle(
  handle: TransformHandle
): string {
  switch (handle.kind) {
    case "axis":
      return handle.axis.toUpperCase();
    case "plane":
      return `plane ⟂ ${handle.normal.toUpperCase()}`;
    default:
      return handle.kind;
  }
}

function round(
  value: number
): number {
  return Math.round(value * 100) / 100;
}

function degrees(
  rotation: THREE.Euler
): THREE.Vector3Like {
  return {
    x: THREE.MathUtils.radToDeg(rotation.x),
    y: THREE.MathUtils.radToDeg(rotation.y),
    z: THREE.MathUtils.radToDeg(rotation.z)
  };
}

applySnap();
showModeFolders();
start();
