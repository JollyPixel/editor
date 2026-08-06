// Import Third-party Dependencies
import * as THREE from "three/webgpu";
import type { BladeApi } from "tweakpane";

// Import Internal Dependencies
import {
  Grid,
  type GridPlane,
  type GridStyle,
  type GridFadeFrom
} from "../../src/index.ts";
import {
  createRenderer,
  createScene,
  createOrbitCamera,
  startLoop
} from "./utils/common.ts";
import { createExamplePane } from "./utils/pane.ts";

const canvas = document.querySelector("canvas") as HTMLCanvasElement;
const renderer = await createRenderer(canvas);

const scene = createScene();
const { camera, controls } = createOrbitCamera(
  canvas,
  { x: 8, y: 6, z: 8 },
  { x: 0, y: 0, z: 0 }
);

scene.add(
  new THREE.AmbientLight("#ffffff", 0.6)
);

const referenceCube = new THREE.Mesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshBasicMaterial({
    color: "#4a90d9"
  })
);
referenceCube.position.y = 0.5;
scene.add(referenceCube);

// Orbits when `fadeFrom` is "target", to make the grid's target-tracking visible.
const kOrbitRadius = 4;
const kOrbitSpeed = 0.6;
const orbitTimer = new THREE.Timer();
let orbitElapsedSeconds = 0;

function updateReferenceCube(): void {
  orbitTimer.update();
  const delta = orbitTimer.getDelta();
  if (grid.fade.from !== "target") {
    referenceCube.position.set(0, 0.5, 0);

    return;
  }

  orbitElapsedSeconds += delta * kOrbitSpeed;
  referenceCube.position.set(
    Math.cos(orbitElapsedSeconds) * kOrbitRadius,
    0.5,
    Math.sin(orbitElapsedSeconds) * kOrbitRadius
  );
}

const pane = createExamplePane();

const gridFolder = pane.addFolder({
  title: "Grid"
});
const axesFolder = pane.addFolder({
  title: "Axes"
});

let grid: Grid;
const gridFolderBindings: BladeApi[] = [];
const axesValueBindings: BladeApi[] = [];

// `extent` is constructor-only; track it locally so rebuilds can preserve it.
let extentValue = 400;

function disposeAll(
  bindings: BladeApi[]
): void {
  for (const binding of bindings) {
    binding.dispose();
  }
  bindings.length = 0;
}

function bindGridControls(
  target: Grid
): void {
  disposeAll(gridFolderBindings);

  // Ignored when `infiniteGrid` is true (see docs/Grid.md); hide it rather than
  // leave a control that visibly does nothing.
  const followCameraBinding = gridFolder.addBinding(target, "followCamera");
  followCameraBinding.hidden = target.infiniteGrid;

  gridFolderBindings.push(
    gridFolder.addBinding(target, "enabled"),
    gridFolder
      .addBinding({ plane: target.plane.value }, "plane", {
        options: {
          xz: "xz",
          xy: "xy",
          yz: "yz"
        }
      })
      .on("change", ({ value }) => rebuildGrid({ plane: value })),
    gridFolder.addBinding(target, "crossSize", {
      min: 0.05,
      max: 0.5,
      step: 0.01
    }),
    gridFolder.addBinding(target, "offset", {
      min: -5,
      max: 5,
      step: 0.1
    }),
    followCameraBinding,
    gridFolder
      .addBinding({ infiniteGrid: target.infiniteGrid }, "infiniteGrid")
      .on("change", ({ value }) => rebuildGrid({ infiniteGrid: value })),
    gridFolder
      .addBinding({ extent: extentValue }, "extent", {
        min: 5,
        max: 500,
        step: 5
      })
      // Rebuild only on release; rebuilding mid-drag disposes the slider and corrupts the value.
      .on("change", ({ value, last }) => {
        if (last) {
          rebuildGrid({ extent: value });
        }
      }),

    gridFolder.addBlade({ view: "separator" }),
    gridFolder
      .addBinding({ fadeFrom: target.fade.from }, "fadeFrom", {
        label: "fadeFrom",
        options: {
          camera: "camera",
          origin: "origin",
          target: "target"
        }
      })
      .on("change", ({ value }) => rebuildGrid({ fadeFrom: value })),
    gridFolder.addBinding(target, "fadeDistance", {
      min: 10,
      max: 500,
      step: 5
    }),
    gridFolder.addBinding(target, "fadeStrength", {
      min: 0.1,
      max: 5,
      step: 0.1
    }),

    gridFolder.addBlade({ view: "separator" }),
    gridFolder
      .addBinding({ cellStyle: target.cellStyle.value }, "cellStyle", {
        options: {
          lines: "lines",
          cross: "cross"
        }
      })
      .on("change", ({ value }) => rebuildGrid({ cellStyle: value })),
    gridFolder.addBinding(target, "cellSize", {
      min: 0.1,
      max: 10,
      step: 0.1
    }),
    gridFolder.addBinding(target.cellColor, "value", {
      label: "cellColor"
    }),
    gridFolder.addBinding(target, "cellThickness", {
      min: 0.5,
      max: 5,
      step: 0.1
    }),
    gridFolder.addBinding(target, "hideCellOnSection"),
    gridFolder.addBinding(target, "hideCellOnSectionFadeWidth", {
      min: 0.05,
      max: 3,
      step: 0.05
    }),

    gridFolder.addBlade({ view: "separator" }),
    gridFolder
      .addBinding({ sectionStyle: target.sectionStyle.value }, "sectionStyle", {
        options: {
          lines: "lines",
          cross: "cross"
        }
      })
      .on("change", ({ value }) => rebuildGrid({ sectionStyle: value })),
    gridFolder.addBinding(target, "sectionSize", {
      min: 2,
      max: 50,
      step: 1
    }),
    gridFolder.addBinding(target.sectionColor, "value", {
      label: "sectionColor"
    }),
    gridFolder.addBinding(target, "sectionThickness", {
      min: 0.5,
      max: 8,
      step: 0.1
    })
  );

  disposeAll(axesValueBindings);
  axesValueBindings.push(
    axesFolder.addBinding(target, "showAxes"),
    axesFolder.addBinding(target, "axisThickness", {
      min: 0.5,
      max: 6,
      step: 0.1
    }),
    axesFolder.addBinding(target.xAxisColor, "value", {
      label: "xAxisColor"
    }),
    axesFolder.addBinding(target.yAxisColor, "value", {
      label: "yAxisColor"
    }),
    axesFolder.addBinding(target.zAxisColor, "value", {
      label: "zAxisColor"
    })
  );
}

interface GridOverrides {
  plane?: GridPlane;
  cellStyle?: GridStyle;
  sectionStyle?: GridStyle;
  fadeFrom?: GridFadeFrom;
  infiniteGrid?: boolean;
  extent?: number;
}

function rebuildGrid(
  overrides: GridOverrides = {}
): void {
  // Defer to let Tweakpane finish its current "change" emit before bindings are disposed.
  queueMicrotask(() => rebuildGridNow(overrides));
}

function rebuildGridNow(
  overrides: GridOverrides
): void {
  scene.remove(grid);
  extentValue = overrides.extent ?? extentValue;

  grid = new Grid({
    plane: overrides.plane ?? grid.plane.value,
    extent: extentValue,
    cell: {
      style: overrides.cellStyle ?? grid.cellStyle.value,
      size: grid.cellSize,
      color: grid.cellColor.value,
      thickness: grid.cellThickness
    },
    section: {
      style: overrides.sectionStyle ?? grid.sectionStyle.value,
      size: grid.sectionSize,
      color: grid.sectionColor.value,
      thickness: grid.sectionThickness
    },
    crossSize: grid.crossSize,
    hideCellOnSection: grid.hideCellOnSection,
    hideCellOnSectionFadeWidth: grid.hideCellOnSectionFadeWidth,
    fade: {
      from: overrides.fadeFrom ?? grid.fade.from,
      target: referenceCube,
      distance: grid.fadeDistance,
      strength: grid.fadeStrength
    },
    axes: {
      show: grid.showAxes,
      thickness: grid.axisThickness,
      xColor: grid.xAxisColor.value,
      yColor: grid.yAxisColor.value,
      zColor: grid.zAxisColor.value
    },
    offset: grid.offset,
    enabled: grid.enabled,
    followCamera: grid.followCamera,
    infiniteGrid: overrides.infiniteGrid ?? grid.infiniteGrid
  });
  scene.add(grid);
  bindGridControls(grid);
}

grid = new Grid();
scene.add(grid);

bindGridControls(grid);

startLoop({
  renderer,
  scene,
  camera,
  controls,
  onFrame: updateReferenceCube
});
