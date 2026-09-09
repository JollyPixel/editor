// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import {
  formatVector
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import {
  Grid,
  TranslationControls,
  type TranslationDirectionPolicy,
  type TranslationGizmoAppearanceOptions,
  type TranslationSpace
} from "../../src/index.ts";
import {
  createExample,
  orbitCamera
} from "../shared/example.ts";

// CONSTANTS
const kSnapOptions: Record<string, number> = {
  "1 unit": 1,
  "half unit": 0.5,
  "4 units": 4,
  Free: 0
};
const kSpaceOptions: Record<string, TranslationSpace> = {
  World: "world",
  Local: "local"
};
const kDirectionOptions: Record<string, TranslationDirectionPolicy> = {
  Positive: "positive",
  Negative: "negative",
  Mirrored: "both"
};
const kShapeOptions = {
  Arrow: "arrow",
  Sphere: "sphere"
} as const;
const kOutlineScaleRange = { min: 1.01, max: 1.5, step: 0.01 };
const kSizeRange = { min: 0.02, max: 0.1, step: 0.005 };
const kCenterRadiusRange = { min: 0.05, max: 0.3, step: 0.01 };

const {
  canvas,
  scene,
  camera,
  controls: orbit,
  pane,
  start
} = await createExample({
  title: "Translation Controls",
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

const target = new THREE.Mesh(
  new THREE.BoxGeometry(2, 2, 2),
  new THREE.MeshStandardMaterial({
    color: "#a7b0bf",
    roughness: 0.65
  })
);
target.position.set(0, 1, 0);
scene.add(target);

const settings = {
  snap: 1,
  space: "world" as TranslationSpace,
  directions: "positive" as TranslationDirectionPolicy,
  shape: "arrow" as "arrow" | "sphere",
  outline: true,
  outlineColor: "#080b11",
  outlineScale: 1.18,
  size: 0.05,
  center: false,
  centerColor: "#ffffff",
  centerRadius: 0.13,
  showX: true,
  showY: true,
  showZ: true
};
const readout = {
  position: formatVector(target.position),
  state: "idle"
};

const statusFolder = pane.addFolder({ title: "Target" });
statusFolder.addMonitor(readout, "position", { label: "Position" });
statusFolder.addMonitor(readout, "state", { label: "Gesture" });

const interactionFolder = pane.addFolder({ title: "Interaction" });
interactionFolder
  .addBinding(settings, "snap", { options: kSnapOptions })
  .on("change", ({ value }) => {
    translation.snap = value === 0 ? null : value;
  });
interactionFolder
  .addBinding(settings, "space", { options: kSpaceOptions })
  .on("change", ({ value }) => {
    translation.space = value;
  });

const appearanceFolder = pane.addFolder({ title: "Appearance" });
appearanceFolder
  .addBinding(settings, "size", {
    ...kSizeRange,
    label: "Size"
  })
  .on("change", rebuild);
appearanceFolder
  .addBinding(settings, "directions", {
    options: kDirectionOptions,
    label: "Directions"
  })
  .on("change", rebuild);
appearanceFolder
  .addBinding(settings, "shape", {
    options: kShapeOptions,
    label: "Handle"
  })
  .on("change", rebuild);
appearanceFolder
  .addBinding(settings, "outline", { label: "Outline" })
  .on("change", rebuild);
appearanceFolder
  .addBinding(settings, "outlineColor", { label: "Outline color" })
  .on("change", rebuild);
appearanceFolder
  .addBinding(settings, "outlineScale", {
    ...kOutlineScaleRange,
    label: "Outline scale"
  })
  .on("change", rebuild);
appearanceFolder
  .addBinding(settings, "center", { label: "Center" })
  .on("change", rebuild);
appearanceFolder
  .addBinding(settings, "centerColor", { label: "Center color" })
  .on("change", rebuild);
appearanceFolder
  .addBinding(settings, "centerRadius", {
    ...kCenterRadiusRange,
    label: "Center radius"
  })
  .on("change", rebuild);

const axesFolder = pane.addFolder({ title: "Axes" });
axesFolder
  .addBinding(settings, "showX", { label: "X" })
  .on("change", rebuild);
axesFolder
  .addBinding(settings, "showY", { label: "Y" })
  .on("change", rebuild);
axesFolder
  .addBinding(settings, "showZ", { label: "Z" })
  .on("change", rebuild);

let translation = createTranslationControls();

function appearance(): TranslationGizmoAppearanceOptions {
  return {
    size: settings.size,
    center: settings.center
      ? {
        color: settings.centerColor,
        radius: settings.centerRadius
      }
      : false,
    directions: settings.directions,
    handle: settings.shape === "arrow"
      ? { kind: "arrow" }
      : { kind: "sphere" },
    axes: {
      x: settings.showX ? {} : false,
      y: settings.showY ? {} : false,
      z: settings.showZ ? {} : false
    },
    outline: settings.outline
      ? {
        color: settings.outlineColor,
        scale: settings.outlineScale
      }
      : false
  };
}

function createTranslationControls(): TranslationControls {
  const controls = new TranslationControls(camera, canvas, {
    snap: settings.snap === 0 ? null : settings.snap,
    space: settings.space,
    appearance: appearance()
  });
  controls.attach(target);
  controls.addEventListener("start", ({ axis }) => {
    orbit.enabled = false;
    readout.state = `dragging ${axis.toUpperCase()}`;
    pane.refresh();
  });
  controls.addEventListener("change", () => {
    readout.position = formatVector(target.position);
    pane.refresh();
  });
  controls.addEventListener("end", () => {
    orbit.enabled = true;
    readout.state = "idle";
    pane.refresh();
  });
  scene.add(controls.helper);

  return controls;
}

function rebuild(): void {
  scene.remove(translation.helper);
  translation.dispose();
  translation = createTranslationControls();
}

start();
