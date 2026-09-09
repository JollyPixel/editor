// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import {
  Grid,
  type GridOptions
} from "../../src/index.ts";
import {
  createExample,
  orbitCamera
} from "../shared/example.ts";

// CONSTANTS
const kOrbitRadius = 4;
const kOrbitSpeed = 0.6;

const { scene, pane, start } = await createExample({
  title: "Grid",
  camera: orbitCamera(
    { x: 8, y: 6, z: 8 },
    { x: 0, y: 0, z: 0 }
  )
});

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

const gridFolder = pane.addFolder({
  title: "Grid"
});
const axesFolder = pane.addFolder({
  title: "Axes"
});

let grid = new Grid({
  fade: { target: referenceCube }
});
scene.add(grid);
bindGridControls(grid);

function bindGridControls(
  target: Grid
): void {
  gridFolder.disposeAll();

  const followCameraBinding = gridFolder.addBinding(target, "followCamera");
  followCameraBinding.hidden = target.infiniteGrid;

  gridFolder.addBinding(target, "enabled");
  gridFolder
    .addBinding({ plane: target.plane.value }, "plane", {
      options: {
        xz: "xz",
        xy: "xy",
        yz: "yz"
      }
    })
    .on("change", ({ value }) => rebuildGrid({ plane: value }));
  gridFolder.addBinding(target, "crossSize", {
    min: 0.05,
    max: 0.5,
    step: 0.01
  });
  gridFolder.addBinding(target, "offset", {
    min: -5,
    max: 5,
    step: 0.1
  });
  gridFolder
    .addBinding({ infiniteGrid: target.infiniteGrid }, "infiniteGrid")
    .on("change", ({ value }) => rebuildGrid({ infiniteGrid: value }));
  gridFolder
    .addBinding({ extent: target.extent }, "extent", {
      min: 5,
      max: 500,
      step: 5
    })
    .on("change", ({ value, last }) => {
      if (last) {
        rebuildGrid({ extent: value });
      }
    });

  gridFolder.addSeparator();
  gridFolder
    .addBinding({ fadeFrom: target.fade.from }, "fadeFrom", {
      label: "fadeFrom",
      options: {
        camera: "camera",
        origin: "origin",
        target: "target"
      }
    })
    .on("change", ({ value }) => rebuildGrid({ fade: { from: value } }));
  gridFolder.addBinding(target, "fadeDistance", {
    min: 10,
    max: 500,
    step: 5
  });
  gridFolder.addBinding(target, "fadeStrength", {
    min: 0.1,
    max: 5,
    step: 0.1
  });

  gridFolder.addSeparator();
  gridFolder
    .addBinding({ cellStyle: target.cellStyle.value }, "cellStyle", {
      options: {
        lines: "lines",
        cross: "cross"
      }
    })
    .on("change", ({ value }) => rebuildGrid({ cell: { style: value } }));
  gridFolder.addBinding(target, "cellSize", {
    min: 0.1,
    max: 10,
    step: 0.1
  });
  gridFolder.addBinding(target.cellColor, "value", {
    label: "cellColor"
  });
  gridFolder.addBinding(target, "cellThickness", {
    min: 0.5,
    max: 5,
    step: 0.1
  });
  gridFolder.addBinding(target, "hideCellOnSection");
  gridFolder.addBinding(target, "hideCellOnSectionFadeWidth", {
    min: 0.05,
    max: 3,
    step: 0.05
  });

  gridFolder.addSeparator();
  gridFolder
    .addBinding({ sectionStyle: target.sectionStyle.value }, "sectionStyle", {
      options: {
        lines: "lines",
        cross: "cross"
      }
    })
    .on("change", ({ value }) => rebuildGrid({ section: { style: value } }));
  gridFolder.addBinding(target, "sectionSize", {
    min: 2,
    max: 50,
    step: 1
  });
  gridFolder.addBinding(target.sectionColor, "value", {
    label: "sectionColor"
  });
  gridFolder.addBinding(target, "sectionThickness", {
    min: 0.5,
    max: 8,
    step: 0.1
  });

  axesFolder.disposeAll();
  axesFolder.addBinding(target, "showAxes");
  axesFolder.addBinding(target, "axisThickness", {
    min: 0.5,
    max: 6,
    step: 0.1
  });
  axesFolder.addBinding(target.xAxisColor, "value", {
    label: "xAxisColor"
  });
  axesFolder.addBinding(target.yAxisColor, "value", {
    label: "yAxisColor"
  });
  axesFolder.addBinding(target.zAxisColor, "value", {
    label: "zAxisColor"
  });
}

function rebuildGrid(
  overrides: GridOptions
): void {
  queueMicrotask(() => {
    const next = grid.cloneWith(overrides);
    scene.remove(grid);
    grid.dispose();

    grid = next;
    scene.add(grid);
    bindGridControls(grid);
  });
}

start({ update: updateReferenceCube });
