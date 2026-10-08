// Import Third-party Dependencies
import * as THREE from "three";
import {
  BlocksetAtlases,
  loadBlocksets,
  type AtlasUVRegion
} from "@jolly-pixel/voxel.renderer";

// Import Internal Dependencies
import { createExamplePane } from "../shared/example-pane.ts";
import { OrbitViewer } from "../shared/OrbitViewer.ts";

// CONSTANTS
const kCols = 3;
const kRows = 3;
const kGap = 1.15;
const kCenterX = (kCols - 1) * kGap * 0.5;
const kCenterZ = -(kRows - 1) * kGap * 0.5;
const kLabelStyle: Partial<CSSStyleDeclaration> = {
  color: "rgba(255,255,255,0.75)",
  fontSize: "9px",
  background: "rgba(0,0,0,0.5)",
  padding: "1px 4px",
  borderRadius: "2px"
};

const atlases = new BlocksetAtlases();
for (const { def, texture } of await loadBlocksets([
  {
    id: "main",
    src: "/blockset/UV_cube.png",
    tileSize: 32
  }
])) {
  atlases.blocksets.add(def);
  atlases.registerTexture(def.id, texture);
}

const viewer = new OrbitViewer({
  position: { x: kCenterX, y: 12, z: kCenterZ + 18 },
  target: { x: kCenterX, y: 0, z: kCenterZ },
  antialias: false
});
const { scene } = viewer;

const sun = new THREE.DirectionalLight("#ffffff", 0.8);
sun.position.set(6, 12, 8);
scene.add(new THREE.AmbientLight("#ffffff", 3), sun);

const quad = new THREE.PlaneGeometry(1, 1)
  .rotateX(-Math.PI / 2)
  .translate(0.5, 0, 0.5);
const border = new THREE.EdgesGeometry(quad);
const borderMaterial = new THREE.LineBasicMaterial({
  color: "#445566",
  opacity: 0.6,
  transparent: true
});
const atlas = atlases.atlas();

for (let row = 0; row < kRows; row++) {
  for (let col = 0; col < kCols; col++) {
    const x = col * kGap;
    const z = -row * kGap;

    const tile = new THREE.Mesh(quad, tileMaterial(atlas.uvFor(col, row)));
    tile.position.set(x, 0, z);

    const outline = new THREE.LineSegments(border, borderMaterial);
    outline.position.set(x, 0.001, z);

    scene.add(tile, outline);
    viewer.label(
      `c${col} r${row}`,
      { x: x + 0.5, y: 0.1, z: z + 0.5 },
      kLabelStyle
    );
  }
}

const pane = createExamplePane();
pane.hidden = true;

await viewer.start();

function tileMaterial(
  uv: AtlasUVRegion
): THREE.MeshLambertMaterial {
  const map = atlas.texture.clone();
  map.repeat.set(uv.scaleU, uv.scaleV);
  map.offset.set(uv.offsetU, uv.offsetV);

  return new THREE.MeshLambertMaterial({
    map,
    side: THREE.DoubleSide
  });
}
