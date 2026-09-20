// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import {
  Grid,
  MarqueeBox
} from "../../src/index.ts";
import {
  createExample,
  orbitCamera
} from "../shared/example.ts";
import { pointerNdc } from "../shared/pointer.ts";

// CONSTANTS
const kExtentRange = { min: 1, max: 24, step: 1 };
const kCoordRange = { min: -20, max: 20, step: 1 };
const kWidthRange = { min: 1, max: 8, step: 0.5 };
const kDashLengthRange = { min: 0.1, max: 4, step: 0.05 };
const kRatioRange = { min: 0, max: 1, step: 0.05 };
const kSpeedRange = { min: -6, max: 6, step: 0.1 };
const kGround = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

interface MarqueePreset {
  width: number;
  dashLength: number;
  ratio: number;
  speed: number;
}

const kPresets: Record<string, MarqueePreset> = {
  "Classic ants": {
    width: 2,
    dashLength: 0.5,
    ratio: 0.5,
    speed: 1.5
  },
  "Slow and wide": {
    width: 4,
    dashLength: 1.5,
    ratio: 0.5,
    speed: 0.4
  },
  Frozen: {
    width: 2,
    dashLength: 0.5,
    ratio: 0.5,
    speed: 0
  }
};

const {
  canvas,
  scene,
  camera,
  controls: orbit,
  pane,
  start
} = await createExample({
  title: "Marquee Box",
  background: "#2b3440",
  camera: orbitCamera(
    { x: 10, y: 9, z: 12 },
    { x: 0, y: 1, z: 0 }
  )
});

scene.add(new Grid({
  cell: {
    size: 1
  },
  section: {
    size: 8
  },
  fade: {
    distance: 60
  },
  axes: {
    show: false
  }
}));

const marquee = new MarqueeBox({
  position: { x: -2, y: 0, z: -2 },
  size: { x: 4, y: 3, z: 3 }
});
scene.add(marquee);

const settings = {
  position: { x: -2, y: 0, z: -2 },
  size: { x: 4, y: 3, z: 3 },
  ...kPresets["Classic ants"],
  dashColor: "#ffffff",
  gapColor: "#000000",
  preset: "Classic ants"
};

const boxFolder = pane.addFolder({
  title: "Box"
});
boxFolder
  .addBinding(settings, "position", {
    label: "Min corner",
    ...kCoordRange
  })
  .on("change", ({ value }) => {
    marquee.position.set(value.x, value.y, value.z);
  });
boxFolder
  .addBinding(settings, "size", {
    label: "Size",
    ...kExtentRange
  })
  .on("change", ({ value }) => {
    marquee.size = value;
  });

const styleFolder = pane.addFolder({
  title: "Style"
});
styleFolder
  .addBinding(settings, "preset", {
    label: "Preset",
    options: Object.fromEntries(
      Object.keys(kPresets).map((name) => [name, name])
    )
  })
  .on("change", ({ value }) => {
    Object.assign(settings, kPresets[value]);
    applyStyle();
    pane.refresh();
  });
styleFolder
  .addBinding(settings, "width", {
    ...kWidthRange,
    label: "Width"
  })
  .on("change", applyStyle);
styleFolder
  .addBinding(settings, "dashLength", {
    ...kDashLengthRange,
    label: "Dash length"
  })
  .on("change", applyStyle);
styleFolder
  .addBinding(settings, "ratio", {
    ...kRatioRange,
    label: "Ratio"
  })
  .on("change", applyStyle);
styleFolder
  .addBinding(settings, "speed", {
    ...kSpeedRange,
    label: "Speed"
  })
  .on("change", applyStyle);
styleFolder
  .addBinding(settings, "dashColor", { label: "Dash color" })
  .on("change", applyStyle);
styleFolder
  .addBinding(settings, "gapColor", { label: "Gap color" })
  .on("change", applyStyle);

function applyStyle(): void {
  const { edges } = marquee;

  edges.width = settings.width;
  edges.dashLength = settings.dashLength;
  edges.ratio = settings.ratio;
  edges.speed = settings.speed;
  edges.colors = [settings.dashColor, settings.gapColor];
}

const raycaster = new THREE.Raycaster();
const groundHit = new THREE.Vector3();
let dragOrigin: THREE.Vector3 | null = null;

function groundCell(
  event: PointerEvent
): THREE.Vector3 | null {
  raycaster.setFromCamera(
    pointerNdc(canvas, event),
    camera
  );
  if (raycaster.ray.intersectPlane(kGround, groundHit) === null) {
    return null;
  }

  return new THREE.Vector3(
    Math.floor(groundHit.x),
    0,
    Math.floor(groundHit.z)
  );
}

function spanCells(
  from: THREE.Vector3,
  to: THREE.Vector3
): void {
  const box = new THREE.Box3().setFromPoints([from, to]);
  box.max.add(new THREE.Vector3(1, settings.size.y, 1));
  marquee.fromBox3(box);

  settings.position = {
    x: marquee.position.x,
    y: marquee.position.y,
    z: marquee.position.z
  };
  settings.size = marquee.size;
  pane.refresh();
}

canvas.addEventListener("pointerdown", (event) => {
  if (event.button !== 0 || !event.shiftKey) {
    return;
  }

  dragOrigin = groundCell(event);
  if (dragOrigin === null) {
    return;
  }

  orbit.enabled = false;
  canvas.setPointerCapture(event.pointerId);
  spanCells(dragOrigin, dragOrigin);
}, true);
canvas.addEventListener("pointermove", (event) => {
  if (dragOrigin === null) {
    return;
  }

  const cell = groundCell(event);
  if (cell !== null) {
    spanCells(dragOrigin, cell);
  }
});
canvas.addEventListener("pointerup", (event) => {
  if (dragOrigin === null) {
    return;
  }

  dragOrigin = null;
  orbit.enabled = true;
  canvas.releasePointerCapture(event.pointerId);
});

start();
