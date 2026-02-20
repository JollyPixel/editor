// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import {
  TilesetManager,
  type TilesetUVRegion
} from "../../src/tileset/TilesetManager.ts";
import {
  type LabelEntry,
  createLabel,
  createRenderer,
  createScene,
  createOrbitCamera,
  startLoop
} from "./utils/common.ts";
import { createExamplesMenu } from "./utils/menu.ts";

// CONSTANTS
const kTileSrc = "/tileset/UV_cube.png";
const kCols = 3;
const kRows = 3;
const kGap = 1.15;

// ── TilesetManager setup ───────────────────────────────────────────────────────

const tilesetManager = new TilesetManager();

await tilesetManager.loadTileset({
  id: "main",
  src: kTileSrc,
  tileSize: 32
});

console.log("[tileset-demo] Tileset loaded. defaultTilesetId:", tilesetManager.defaultTilesetId);
// console.log("[tileset-demo] Definitions:", tilesetManager.getDefinitions());

// // Log all UV regions for verification
// for (let row = 0; row < kRows; row++) {
//   for (let col = 0; col < kCols; col++) {
//     const uv = tilesetManager.getTileUV({ col, row });
//     console.log(`  tile(col=${col}, row=${row}):`, uv);
//   }
// }

// ── Renderer ──────────────────────────────────────────────────────────────────

const canvas = document.querySelector("canvas") as HTMLCanvasElement;
const renderer = createRenderer(canvas, false);

// ── Scene & camera ─────────────────────────────────────────────────────────────

const scene = createScene();

// Center of the tile grid (9 cols × 4 rows)
const kGridW = (kCols - 1) * kGap;
const kGridH = (kRows - 1) * kGap;
const kCenterX = kGridW * 0.5;
const kCenterZ = -kGridH * 0.5;

const { camera, controls } = createOrbitCamera(
  canvas,
  { x: kCenterX, y: 12, z: kCenterZ + 18 },
  { x: kCenterX, y: 0, z: kCenterZ }
);

// ── Lighting ───────────────────────────────────────────────────────────────────

scene.add(new THREE.AmbientLight("#ffffff", 3));

const dirLight = new THREE.DirectionalLight("#ffffff", 0.8);
dirLight.position.set(6, 12, 8);
scene.add(dirLight);

// ── Helpers ───────────────────────────────────────────────────────────────────

const texture = tilesetManager.getTexture()!;

/**
 * Creates a MeshLambertMaterial for a single tile.
 * THREE.Texture.offset and .repeat map directly to TilesetUVRegion, so no UV
 * arithmetic is needed in the geometry. texture.clone() shares the same GPU
 * upload (Three.js deduplicates by texture.source) while giving each mesh its
 * own independent offset/repeat transform.
 */
function createTileMaterial(uv: TilesetUVRegion): THREE.MeshLambertMaterial {
  const tileTexture = texture.clone();
  tileTexture.repeat.set(uv.scaleU, uv.scaleV);
  tileTexture.offset.set(uv.offsetU, uv.offsetV);

  return new THREE.MeshLambertMaterial({
    map: tileTexture,
    side: THREE.DoubleSide,
    alphaTest: 0
  });
}

// Shared geometry for all flat tile quads — only the material differs per tile.
const kQuadGeo = new THREE.PlaneGeometry(1, 1)
  .rotateX(-Math.PI / 2)
  .translate(0.5, 0, 0.5);

// ── Tile grid — one quad per tile ──────────────────────────────────────────────

const labelEntries: LabelEntry[] = [];

for (let row = 0; row < kRows; row++) {
  for (let col = 0; col < kCols; col++) {
    const uv = tilesetManager.getTileUV({ col, row });
    const mesh = new THREE.Mesh(kQuadGeo, createTileMaterial(uv));
    mesh.position.set(col * kGap, 0, -row * kGap);
    scene.add(mesh);

    // Thin border around each tile quad
    const borderGeo = new THREE.EdgesGeometry(
      new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0.5, 0, 0.5)
    );
    const borderMesh = new THREE.LineSegments(
      borderGeo,
      new THREE.LineBasicMaterial({ color: "#445566", opacity: 0.6, transparent: true })
    );
    borderMesh.position.set(col * kGap, 0.001, -row * kGap);
    scene.add(borderMesh);

    // Label: col/row coordinates
    labelEntries.push(createLabel(
      `c${col} r${row}`,
      new THREE.Vector3(col * kGap + 0.5, 0.1, -row * kGap + 0.5),
      {
        color: "rgba(255,255,255,0.75)",
        fontSize: "9px",
        background: "rgba(0,0,0,0.5)",
        padding: "1px 4px",
        borderRadius: "2px"
      }
    ));
  }
}

// ── Animation loop ─────────────────────────────────────────────────────────────

createExamplesMenu();
startLoop(renderer, scene, camera, controls, labelEntries);
