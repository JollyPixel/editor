// Import Third-party Dependencies
import * as THREE from "three";
import {
  abs,
  cameraPosition,
  color,
  float,
  fract,
  fwidth,
  min,
  mix,
  positionWorld,
  smoothstep,
  uv
} from "three/tsl";
import { MeshStandardNodeMaterial } from "three/webgpu";

// CONSTANTS
export const OVERLAY_LAYER = 1;

const kGroundColor = "#232236";
const kGridColor = "#4a4868";
const kLabelWidth = 2;
const kLabelTexels: THREE.Vector2Like = { x: 512, y: 96 };
const kLabelHeight = kLabelWidth * kLabelTexels.y / kLabelTexels.x;

const kGridLine = abs(fract(positionWorld.xz.sub(0.5)).sub(0.5))
  .div(fwidth(positionWorld.xz));
const kGridMask = float(1).sub(min(min(kGridLine.x, kGridLine.y), 1));
const kGridFade = smoothstep(48, 6, positionWorld.sub(cameraPosition).length());

const kPatchMaterial = new MeshStandardNodeMaterial({
  roughness: 1,
  transparent: true,
  depthWrite: false
});
kPatchMaterial.colorNode = color(kGroundColor);
kPatchMaterial.opacityNode = smoothstep(0, 0.3, uv().x)
  .mul(smoothstep(1, 0.7, uv().x))
  .mul(smoothstep(0, 0.45, uv().y))
  .mul(smoothstep(1, 0.55, uv().y));

export function createGround(
  center: THREE.Vector3Like
): THREE.Mesh {
  const material = new MeshStandardNodeMaterial({ roughness: 1 });
  material.colorNode = mix(
    color(kGroundColor),
    color(kGridColor),
    kGridMask.mul(kGridFade).mul(0.45)
  );

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), material);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(center.x, -0.001, center.z);
  ground.receiveShadow = true;

  return ground;
}

export function createGroundLabel(
  text: string
): THREE.Group {
  const patch = new THREE.Mesh(
    new THREE.PlaneGeometry(kLabelWidth * 1.3, kLabelHeight * 2.4),
    kPatchMaterial
  );
  patch.position.y = 0.004;
  patch.receiveShadow = true;
  patch.renderOrder = 1;

  const lettering = new THREE.Mesh(
    new THREE.PlaneGeometry(kLabelWidth, kLabelHeight),
    new THREE.MeshBasicMaterial({
      map: textTexture(text),
      transparent: true,
      depthWrite: false,
      toneMapped: false
    })
  );
  lettering.position.y = 0.008;
  lettering.renderOrder = 2;

  const label = new THREE.Group();
  for (const plane of [patch, lettering]) {
    plane.rotation.x = -Math.PI / 2;
    plane.layers.set(OVERLAY_LAYER);
    label.add(plane);
  }

  return label;
}

function textTexture(
  text: string
): THREE.CanvasTexture {
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

  return texture;
}
