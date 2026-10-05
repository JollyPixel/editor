// Import Third-party Dependencies
import * as THREE from "three";
import { ao } from "three/addons/tsl/display/GTAONode.js";
import {
  abs,
  builtinAOContext,
  cameraPosition,
  color,
  float,
  fract,
  fwidth,
  min,
  mix,
  mrt,
  normalView,
  normalWorld,
  pass,
  positionWorld,
  screenUV,
  smoothstep,
  uniform,
  uv
} from "three/tsl";
import {
  MeshStandardNodeMaterial,
  RenderPipeline
} from "three/webgpu";

// Import Internal Dependencies
import {
  BlockShapeRegistry,
  type BlockShape
} from "../../src/document/blocks/shape/index.ts";
import {
  createRenderer,
  createScene,
  createOrbitCamera,
  startLoop
} from "./utils/common.ts";
import { createExamplePane } from "./utils/example-switcher.ts";

// CONSTANTS

// Whole units, so every block sits exactly in one cell of the ground grid.
const kGap = 3;
// Poles get their own block, one row per rise (none, up, through), right of the other families.
const kPoleColumns = 5;
const kPoleOffset = 7;
const kFamilyColors: Record<string, string> = {
  cube: "#4a90d9",
  slab: "#7ed321",
  wall: "#9ccc65",
  pole: "#ab47bc",
  ramp: "#f5a623",
  stair: "#5c6bc0"
};

interface Placement {
  shape: BlockShape;
  family: string;
  col: number;
  row: number;
}

function familyOf(shape: BlockShape): string {
  return /^[a-z]+/u.exec(shape.id)![0];
}

/**
 * One row per family, cubes sharing the slab row, and poles as a block on
 * the side.
 */
function placeShapes(shapes: readonly BlockShape[]): Placement[] {
  const rows: string[] = [];
  const counts = new Map<string, number>();

  return shapes.map((shape) => {
    const family = familyOf(shape);
    const group = family === "cube" ? "slab" : family;
    const index = counts.get(group) ?? 0;
    counts.set(group, index + 1);

    if (group === "pole") {
      return {
        shape,
        family,
        col: kPoleOffset + (index % kPoleColumns),
        row: Math.floor(index / kPoleColumns)
      };
    }
    if (!rows.includes(group)) {
      rows.push(group);
    }

    return {
      shape,
      family,
      col: index,
      row: rows.indexOf(group)
    };
  });
}

const kPlacements = placeShapes([...BlockShapeRegistry.createDefault()]);
const kCols = Math.max(...kPlacements.map(({ col }) => col)) + 1;
const kRows = Math.max(...kPlacements.map(({ row }) => row)) + 1;

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
const renderer = createRenderer(canvas, false);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

// ── Scene & camera ─────────────────────────────────────────────────────────────

const kSkyZenith = "#07080f";
const kSkyHorizon = "#2b2940";
const kGroundColor = "#232236";
const kGridColor = "#4a4868";

const scene = createScene(kSkyHorizon);
scene.backgroundNode = mix(
  color(kSkyHorizon),
  color(kSkyZenith),
  smoothstep(0, 0.6, normalWorld.y)
);
// Same colour as the horizon, so the ground fades into the sky with no edge.
scene.fog = new THREE.Fog(kSkyHorizon, 30, 90);

// Grid center: midpoint of the layout
const kCenterX = ((kCols - 1) * kGap * 0.5) + 0.5;
const kCenterZ = (-(kRows - 1) * kGap * 0.5) + 0.5;

const { camera, controls } = createOrbitCamera(
  canvas,
  { x: kCenterX, y: 14, z: kCenterZ + 22 },
  { x: kCenterX, y: 0.5, z: kCenterZ }
);
// Stays above the ground, which is only visible from above.
controls.maxPolarAngle = (Math.PI / 2) - 0.05;

// Wireframes and ground labels live on their own layer so the AO pre-pass never sees them.
const kOverlayLayer = 1;
camera.layers.enable(kOverlayLayer);
/*
 * The AO pre-pass renders while the scene pass is drawing, and three caches one
 * render list per camera, so sharing the scene camera would empty the overlay.
 */
const aoCamera = camera.clone();

// ── Lighting ───────────────────────────────────────────────────────────────────

scene.add(new THREE.HemisphereLight("#c9d6ff", "#4a3e58", 2.6));

const sun = new THREE.DirectionalLight("#fff1dc", 2);
sun.position.set(kCenterX + 7, 12, kCenterZ + 9);
sun.target.position.set(kCenterX, 0, kCenterZ);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.02;
const kShadowExtent = Math.max(kCols, kRows) * kGap * 0.75;
Object.assign(sun.shadow.camera, {
  left: -kShadowExtent,
  right: kShadowExtent,
  top: kShadowExtent,
  bottom: -kShadowExtent,
  near: 1,
  far: 40
});
scene.add(sun, sun.target);

// One line per block cell, anti-aliased with fwidth and faded out with distance.
const kGridLine = abs(fract(positionWorld.xz.sub(0.5)).sub(0.5)).div(fwidth(positionWorld.xz));
const kGridMask = float(1).sub(min(min(kGridLine.x, kGridLine.y), 1));
const kGridFade = smoothstep(48, 6, positionWorld.sub(cameraPosition).length());

const groundMaterial = new MeshStandardNodeMaterial({ roughness: 1 });
groundMaterial.colorNode = mix(
  color(kGroundColor),
  color(kGridColor),
  kGridMask.mul(kGridFade).mul(0.45)
);

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(400, 400),
  groundMaterial
);
ground.rotation.x = -Math.PI / 2;
ground.position.set(kCenterX, -0.001, kCenterZ);
ground.receiveShadow = true;
scene.add(ground);

// ── Build shape meshes & ground labels ────────────────────────────────────────

const kLabelWidth = 2;
const kLabelTexels: THREE.Vector2Like = { x: 512, y: 96 };

// Lit like the ground so it blends in, fading out towards its edges to hide the grid.
const labelPatchMaterial = new MeshStandardNodeMaterial({
  roughness: 1,
  transparent: true,
  depthWrite: false
});
labelPatchMaterial.colorNode = color(kGroundColor);
labelPatchMaterial.opacityNode = smoothstep(0, 0.3, uv().x)
  .mul(smoothstep(1, 0.7, uv().x))
  .mul(smoothstep(0, 0.45, uv().y))
  .mul(smoothstep(1, 0.55, uv().y));

/**
 * Prints the text on a flat plane lying on the ground, over a soft patch of
 * ground, so the label stays put in the scene instead of following the screen.
 */
function createGroundLabel(text: string): THREE.Group {
  const canvas = document.createElement("canvas");
  canvas.width = kLabelTexels.x;
  canvas.height = kLabelTexels.y;
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#ffffff";
  context.font = "bold 38px monospace";
  context.letterSpacing = "3px";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 16;

  const labelHeight = kLabelWidth * kLabelTexels.y / kLabelTexels.x;
  const patch = new THREE.Mesh(
    new THREE.PlaneGeometry(kLabelWidth * 1.3, labelHeight * 2.4),
    labelPatchMaterial
  );
  patch.position.y = 0.004;
  patch.receiveShadow = true;
  patch.renderOrder = 1;

  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(kLabelWidth, labelHeight),
    new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      toneMapped: false
    })
  );
  mesh.position.y = 0.008;
  mesh.renderOrder = 2;

  const label = new THREE.Group();
  for (const plane of [patch, mesh]) {
    plane.rotation.x = -Math.PI / 2;
    plane.layers.set(kOverlayLayer);
    label.add(plane);
  }

  return label;
}

const labelMeshes: THREE.Group[] = [];
const wireMeshes: THREE.Mesh[] = [];

const wireMat = new THREE.MeshBasicMaterial({
  color: "#000000",
  wireframe: true
});

for (const { shape, family, col, row } of kPlacements) {
  // Shades each column from its family's colour, so neighbours stay apart.
  const color = new THREE.Color(kFamilyColors[family])
    .offsetHSL(0, 0, ((col % 5) - 2) * 0.06);
  const x = col * kGap;
  const z = -row * kGap;

  const geo = buildGeometry(shape);

  const solidMesh = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.75 })
  );
  solidMesh.position.set(x, 0, z);
  solidMesh.castShadow = true;
  solidMesh.receiveShadow = true;
  scene.add(solidMesh);

  const wireMesh = new THREE.Mesh(geo, wireMat);
  wireMesh.position.set(x, 0, z);
  wireMesh.layers.set(kOverlayLayer);
  wireMesh.visible = false;
  wireMeshes.push(wireMesh);
  scene.add(wireMesh);

  const labelMesh = createGroundLabel(shape.id);
  labelMesh.position.set(x + 0.5, 0, z + 1.35);
  labelMeshes.push(labelMesh);
  scene.add(labelMesh);
}

// ── Ambient occlusion ──────────────────────────────────────────────────────────

const prePass = pass(scene, aoCamera, { samples: 0 });
prePass.setLayers(new THREE.Layers());
prePass.setMRT(mrt({ output: normalView }));

const aoPass = ao(prePass.getTextureNode("depth"), prePass.getTextureNode(), aoCamera);
aoPass.radius.value = 1;
aoPass.scale.value = 1.6;

const aoStrength = uniform(1);
const scenePass = pass(scene, camera, { samples: 4 });
scenePass.contextNode = builtinAOContext(
  mix(float(1), aoPass.getTextureNode().sample(screenUV).r, aoStrength)
);

const pipeline = new RenderPipeline(renderer, scenePass);

// ── Options ────────────────────────────────────────────────────────────────────

const display = {
  labels: true,
  wireframe: false,
  ambientOcclusion: true
};

const pane = createExamplePane({ title: "Block Shapes" });
pane
  .addBinding(display, "labels", { label: "labels" })
  .on("change", ({ value }) => {
    for (const mesh of labelMeshes) {
      mesh.visible = value;
    }
  });
pane
  .addBinding(display, "wireframe", { label: "wireframe" })
  .on("change", ({ value }) => {
    for (const mesh of wireMeshes) {
      mesh.visible = value;
    }
  });
pane
  .addBinding(display, "ambientOcclusion", { label: "ambient occlusion" })
  .on("change", ({ value }) => {
    aoStrength.value = value ? 1 : 0;
  });

// ── Animation loop ─────────────────────────────────────────────────────────────

await startLoop({
  renderer,
  scene,
  camera,
  controls,
  render: () => {
    aoCamera.copy(camera);
    pipeline.render();
  }
});
