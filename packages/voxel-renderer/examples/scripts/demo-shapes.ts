// Import Third-party Dependencies
import * as THREE from "three";
import { ViewHelper } from "three/addons/helpers/ViewHelper.js";

// Import Internal Dependencies
import type { BlockShape } from "../../src/blocks/BlockShape.ts";
import {
  type LabelEntry,
  createLabel,
  createRenderer,
  createScene,
  createOrbitCamera,
  startLoop
} from "./utils/common.ts";
import { createExamplesMenu } from "./utils/menu.ts";
import { Cube } from "../../src/blocks/shapes/Cube.ts";
import { Slab } from "../../src/blocks/shapes/Slab.ts";
import { PoleY } from "../../src/blocks/shapes/PoleY.ts";
import { Pole } from "../../src/blocks/shapes/Pole.ts";
import { PoleCross } from "../../src/blocks/shapes/PoleCross.ts";
import { Ramp } from "../../src/blocks/shapes/Ramp.ts";
import { RampFlip } from "../../src/blocks/shapes/RampFlip.ts";
import {
  RampCornerInner,
  RampCornerOuter,
  RampCornerInnerFlip,
  RampCornerOuterFlip
} from "../../src/blocks/shapes/RampCorner.ts";
import {
  Stair,
  StairCornerInner,
  StairCornerOuter,
  StairFlip,
  StairCornerInnerFlip,
  StairCornerOuterFlip
} from "../../src/blocks/shapes/Stair.ts";

// CONSTANTS
const kGap = 2.5;
const kCols = 4;

interface ShapeEntry {
  shape: BlockShape;
  label: string;
  color: string;
}

const kShapes: ShapeEntry[] = [
  // ── Solid / Slab ────────────────────────────────────────────────────────────
  {
    shape: new Cube(),
    label: "cube",
    color: "#4a90d9"
  },
  {
    shape: new Slab("bottom"),
    label: "slabBottom",
    color: "#7ed321"
  },
  {
    shape: new Slab("top"),
    label: "slabTop",
    color: "#2e7d32"
  },

  // ── Pole / Beam ─────────────────────────────────────────────────────────────
  {
    shape: new PoleY(),
    label: "poleY",
    color: "#26c6da"
  },
  {
    shape: new Pole("x"),
    label: "poleX",
    color: "#ff7043"
  },
  {
    shape: new Pole("z"),
    label: "poleZ",
    color: "#ab47bc"
  },
  {
    shape: new PoleCross(),
    label: "poleCross",
    color: "#66bb6a"
  },

  // ── Ramp ────────────────────────────────────────────────────────────────────
  {
    shape: new Ramp(),
    label: "ramp",
    color: "#f5a623"
  },
  {
    shape: new RampFlip(),
    label: "rampFlip",
    color: "#f9a825"
  },
  {
    shape: new RampCornerInner(),
    label: "rampCornerInner",
    color: "#e53935"
  },
  {
    shape: new RampCornerOuter(),
    label: "rampCornerOuter",
    color: "#9c27b0"
  },
  {
    shape: new RampCornerInnerFlip(),
    label: "rampCornerInnerFlip",
    color: "#c62828"
  },
  {
    shape: new RampCornerOuterFlip(),
    label: "rampCornerOuterFlip",
    color: "#6a1b9a"
  },

  // ── Stair ───────────────────────────────────────────────────────────────────
  {
    shape: new Stair(),
    label: "stair",
    color: "#5c6bc0"
  },
  {
    shape: new StairCornerInner(),
    label: "stairCornerInner",
    color: "#d84315"
  },
  {
    shape: new StairCornerOuter(),
    label: "stairCornerOuter",
    color: "#00897b"
  },
  {
    shape: new StairFlip(),
    label: "stairFlip",
    color: "#3949ab"
  },
  {
    shape: new StairCornerInnerFlip(),
    label: "stairCornerInnerFlip",
    color: "#bf360c"
  },
  {
    shape: new StairCornerOuterFlip(),
    label: "stairCornerOuterFlip",
    color: "#00695c"
  }
];

/**
 * Builds a BufferGeometry from a BlockShape's FaceDefinition list.
 * Triangles (3 vertices) use indices [0,1,2]; quads (4 vertices) are
 * triangulated as [0,1,2] + [0,2,3].
 */
function buildGeometry(shape: BlockShape): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];

  for (const { vertices, normal } of shape.faces) {
    const indices = vertices.length === 3 ?
      [0, 1, 2] :
      [0, 1, 2, 0, 2, 3];

    for (const idx of indices) {
      positions.push(vertices[idx][0], vertices[idx][1], vertices[idx][2]);
      normals.push(normal[0], normal[1], normal[2]);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));

  return geo;
}

// ── Renderer ──────────────────────────────────────────────────────────────────

const canvas = document.querySelector("canvas") as HTMLCanvasElement;
const renderer = createRenderer(canvas);
renderer.autoClear = false;
// ── Scene & camera ─────────────────────────────────────────────────────────────

const scene = createScene();

// Grid center: midpoint of the 4×5 layout
const kCenterX = (kCols - 1) * kGap * 0.5;
const kCenterZ = -(Math.ceil(kShapes.length / kCols) - 1) * kGap * 0.5;

const { camera, controls } = createOrbitCamera(
  canvas,
  { x: kCenterX, y: 6, z: kCenterZ + 10 },
  { x: kCenterX, y: 0.5, z: kCenterZ }
);

const helper = new ViewHelper(camera, renderer.domElement);
helper.setLabels("X", "Y", "Z");

// ── Lighting ───────────────────────────────────────────────────────────────────

scene.add(new THREE.AmbientLight("#ffffff", 0.45));

const dirLight = new THREE.DirectionalLight("#ffffff", 1.4);
dirLight.position.set(6, 12, 8);
scene.add(dirLight);

const backLight = new THREE.DirectionalLight("#8090ff", 0.3);
backLight.position.set(-4, 4, -6);
scene.add(backLight);

// ── Grid ───────────────────────────────────────────────────────────────────────

const gridHelper = new THREE.GridHelper(30, 30, "#334", "#223");
scene.add(gridHelper);

// ── Build shape meshes & HTML labels ──────────────────────────────────────────

const labelEntries: LabelEntry[] = [];

const wireMat = new THREE.MeshBasicMaterial({
  color: "#ffffff",
  wireframe: true,
  opacity: 0.12,
  transparent: true
});

for (let i = 0; i < kShapes.length; i++) {
  const { shape, label, color } = kShapes[i];
  const col = i % kCols;
  const row = Math.floor(i / kCols);
  const x = col * kGap;
  const z = -row * kGap;

  const geo = buildGeometry(shape);

  // Solid colored mesh
  const solidMesh = new THREE.Mesh(
    geo,
    new THREE.MeshPhongMaterial({ color, flatShading: true, side: THREE.FrontSide })
  );
  solidMesh.position.set(x, 0, z);
  scene.add(solidMesh);

  // Wireframe overlay on shared geometry
  const wireMesh = new THREE.Mesh(geo, wireMat);
  wireMesh.position.set(x, 0, z);
  scene.add(wireMesh);

  // HTML label — updated each frame via 3D→2D projection
  // Float slightly above the shape (y=1.5 covers the tallest shape)
  labelEntries.push(createLabel(label, new THREE.Vector3(x + 0.5, 1.5, z + 0.5)));
}

// ── Animation loop ─────────────────────────────────────────────────────────────

createExamplesMenu();
startLoop(renderer, scene, camera, controls, labelEntries, () => {
  helper.render(renderer);
});
