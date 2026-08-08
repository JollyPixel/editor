// Import Third-party Dependencies
import {
  type Actor,
  ActorComponent
} from "@jolly-pixel/engine";
import * as THREE from "three";
import type {
  UVFace,
  UVRegion,
  SelectionRect,
  Vec2
} from "@jolly-pixel/pixel-draw.renderer";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export interface CubeBehaviorOptions {
  canvasTexture: THREE.CanvasTexture;
  region: UVRegion;
  textureSize: Vec2;
}

/**
 * Rotating test cube mapped to one UV region (one rect per face when uncollapsed).
 */
// CONSTANTS
const kCubeSize = 1.5;
/**
 * Maps face names to BoxGeometry vertex offsets (+X, -X, +Y, -Y, +Z, -Z order).
 */
const kFaceVertexOffset: Record<UVFace, number> = {
  right: 0,
  left: 4,
  top: 8,
  bottom: 12,
  front: 16,
  back: 20
};
const kVerticesPerFace = 4;
const kBorderRadius = 0.025;
const kBorderRadialSegments = 8;
const kBorderCapSegments = 4;
const kFaceLabelCanvasWidth = 256;
const kFaceLabelCanvasHeight = 64;
const kFaceLabelWidth = 0.58;
const kFaceLabelHeight = kFaceLabelWidth * (
  kFaceLabelCanvasHeight / kFaceLabelCanvasWidth
);
const kFaceLabelMargin = 0.09;
const kFaceLabelSurfaceOffset = 0.003;
// Both in rad/sec.
const kRotationSpeedX = 0.3;
const kRotationSpeedY = 0.6;
// Higher = snaps into position faster. Frame-rate independent (see update()).
const kPositionLerpRate = 6;

export class CubeBehavior extends ActorComponent {
  mesh: THREE.Mesh;
  canvasTexture: THREE.CanvasTexture;
  readonly regionId: string;

  #borderMaterial: THREE.MeshBasicMaterial;
  #borderColor = new THREE.Color(0x101820);
  #selectionColor: THREE.Color;
  #selected = false;
  #rotating = true;
  /**
   * Pristine BoxGeometry UVs (0 or 1 per component). Remaps always derive
   * corner identity from this snapshot, never from the live (remapped) attribute.
   */
  #baseUV: Float32Array;
  /**
   * Easing target for `#relayout` grid placement.
   */
  #targetPosition: THREE.Vector3;

  constructor(
    actor: Actor,
    options: CubeBehaviorOptions
  ) {
    super({
      actor,
      typeName: "CubeBehavior"
    });

    const { canvasTexture, region, textureSize } = options;

    this.regionId = region.id;
    this.canvasTexture = canvasTexture;

    const geometry = new THREE.BoxGeometry(
      kCubeSize,
      kCubeSize,
      kCubeSize
    );
    this.#baseUV = Float32Array.from(
      geometry.attributes.uv.array
    );

    this.mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({
        map: canvasTexture,
        transparent: true
      })
    );
    this.mesh.userData.regionId = region.id;
    this.applyRegion(region, textureSize);

    this.#borderMaterial = new THREE.MeshBasicMaterial({
      color: this.#borderColor,
      toneMapped: false
    });
    const borderMesh = createRoundedBorder(
      kCubeSize,
      kBorderRadius,
      this.#borderMaterial
    );
    this.#selectionColor = new THREE.Color(region.color);

    this.actor.addChildren(
      this.mesh,
      borderMesh,
      ...createFaceLabels()
    );
    this.#targetPosition = this.actor.object3D.position.clone();
  }

  /**
   * Eases toward `position` over the next few frames (smooth grid reflow).
   */
  setTargetPosition(
    position: THREE.Vector3
  ): void {
    this.#targetPosition.copy(position);
  }

  /**
   * Remaps every face from the region's current state.
   */
  applyRegion(
    region: UVRegion,
    textureSize: Vec2
  ): void {
    for (const { face, rect } of region.facesOf()) {
      this.applyFace(face, rect, textureSize);
    }
  }

  /**
   * Remaps one face, or all faces when `face` is null (collapsed region).
   */
  applyFace(
    face: UVFace | null,
    rect: SelectionRect,
    textureSize: Vec2
  ): void {
    if (face === null) {
      this.#applyRectToRange(
        rect,
        textureSize,
        0,
        this.#baseUV.length / 2
      );
    }
    else {
      this.#applyRectToRange(
        rect,
        textureSize,
        kFaceVertexOffset[face],
        kVerticesPerFace
      );
    }

    this.mesh.geometry.attributes.uv.needsUpdate = true;
  }

  setSelected(
    selected: boolean
  ): void {
    this.#selected = selected;
    this.#syncBorderColor();
  }

  setBorderColor(
    color: THREE.ColorRepresentation
  ): void {
    this.#borderColor.set(color);
    this.#syncBorderColor();
  }

  setRotating(
    rotating: boolean
  ): void {
    this.#rotating = rotating;
  }

  setRotation(
    rotation: THREE.Euler
  ): void {
    this.actor.object3D.rotation.copy(rotation);
  }

  #syncBorderColor(): void {
    this.#borderMaterial.color.copy(
      this.#selected ? this.#selectionColor : this.#borderColor
    );
  }

  update(
    deltaTime: number
  ): void {
    if (this.#rotating) {
      this.actor.object3D.rotation.x += kRotationSpeedX * deltaTime;
      this.actor.object3D.rotation.y += kRotationSpeedY * deltaTime;
    }

    // Frame-rate-independent exponential ease.
    const alpha = 1 - Math.exp(-kPositionLerpRate * deltaTime);
    this.actor.object3D.position.lerp(
      this.#targetPosition,
      alpha
    );

    this.canvasTexture.needsUpdate = true;
  }

  /**
   * Remaps BoxGeometry's 0..1 UVs onto the rect for `count` vertices from `start`.
   * Uses `#baseUV` for corner identity; V is flipped for CanvasTexture's flipY.
   */
  #applyRectToRange(
    rect: SelectionRect,
    textureSize: Vec2,
    start: number,
    count: number
  ): void {
    const uvAttr = this.mesh.geometry.attributes.uv;
    const u0 = rect.x / textureSize.x;
    const u1 = (rect.x + rect.width) / textureSize.x;
    const v0 = 1 - ((rect.y + rect.height) / textureSize.y);
    const v1 = 1 - (rect.y / textureSize.y);

    for (let i = start; i < start + count; i++) {
      const u = this.#baseUV[i * 2];
      const v = this.#baseUV[(i * 2) + 1];
      uvAttr.setXY(i, u === 0 ? u0 : u1, v === 0 ? v0 : v1);
    }
  }
}

/**
 * Creates face-attached labels that use each face's local top-left corner.
 */
function createFaceLabels(): THREE.Object3D[] {
  return (Object.entries(kFaceVertexOffset) as [UVFace, number][])
    .map(([face]) => {
      const label = new THREE.Mesh(
        new THREE.PlaneGeometry(kFaceLabelWidth, kFaceLabelHeight),
        createFaceLabelMaterial(face)
      );
      const faceObject = new THREE.Object3D();
      const halfSize = kCubeSize / 2;

      label.position.set(
        -halfSize + kFaceLabelMargin + (kFaceLabelWidth / 2),
        halfSize - kFaceLabelMargin - (kFaceLabelHeight / 2),
        halfSize + kFaceLabelSurfaceOffset
      );
      faceObject.rotation.copy(faceRotation(face));
      faceObject.add(label);

      return faceObject;
    });
}

function createFaceLabelMaterial(
  face: UVFace
): THREE.MeshBasicMaterial {
  const canvas = document.createElement("canvas");
  canvas.width = kFaceLabelCanvasWidth;
  canvas.height = kFaceLabelCanvasHeight;

  const context = canvas.getContext("2d");
  if (context === null) {
    throw new Error("Unable to create face label canvas context");
  }

  context.font = "600 38px sans-serif";
  context.textBaseline = "middle";
  context.lineJoin = "round";
  context.lineWidth = 8;
  context.strokeStyle = "rgba(0, 0, 0, 0.8)";
  context.fillStyle = "#ffffff";
  context.strokeText(face.toUpperCase(), 12, kFaceLabelCanvasHeight / 2);
  context.fillText(face.toUpperCase(), 12, kFaceLabelCanvasHeight / 2);

  return new THREE.MeshBasicMaterial({
    map: new THREE.CanvasTexture(canvas),
    transparent: true,
    depthWrite: false,
    toneMapped: false
  });
}

function faceRotation(
  face: UVFace
): THREE.Euler {
  switch (face) {
    case "right":
      return new THREE.Euler(0, Math.PI / 2, 0);
    case "left":
      return new THREE.Euler(0, -Math.PI / 2, 0);
    case "top":
      return new THREE.Euler(-Math.PI / 2, 0, 0);
    case "bottom":
      return new THREE.Euler(Math.PI / 2, 0, 0);
    case "back":
      return new THREE.Euler(0, Math.PI, 0);
    case "front":
      return new THREE.Euler();
    default:
      throw new Error(`Unknown cube face: ${face}`);
  }
}

function createRoundedBorder(
  size: number,
  radius: number,
  material: THREE.MeshBasicMaterial
): THREE.Mesh {
  const halfSize = size / 2;
  const edgeLength = size - (radius * 2);
  const geometries: THREE.BufferGeometry[] = [];

  for (const x of [-halfSize, halfSize]) {
    for (const z of [-halfSize, halfSize]) {
      geometries.push(createBorderEdgeGeometry(
        edgeLength,
        radius,
        new THREE.Vector3(x, 0, z)
      ));
    }
  }

  for (const y of [-halfSize, halfSize]) {
    for (const z of [-halfSize, halfSize]) {
      geometries.push(createBorderEdgeGeometry(
        edgeLength,
        radius,
        new THREE.Vector3(0, y, z),
        new THREE.Euler(0, 0, Math.PI / 2)
      ));
    }
  }

  for (const x of [-halfSize, halfSize]) {
    for (const y of [-halfSize, halfSize]) {
      geometries.push(createBorderEdgeGeometry(
        edgeLength,
        radius,
        new THREE.Vector3(x, y, 0),
        new THREE.Euler(Math.PI / 2, 0, 0)
      ));
    }
  }

  for (const x of [-halfSize, halfSize]) {
    for (const y of [-halfSize, halfSize]) {
      for (const z of [-halfSize, halfSize]) {
        const corner = new THREE.SphereGeometry(
          radius,
          kBorderRadialSegments,
          kBorderCapSegments * 2
        );
        corner.translate(x, y, z);
        geometries.push(corner);
      }
    }
  }

  const borderGeometry = mergeGeometries(geometries);
  if (borderGeometry === null) {
    throw new Error("Unable to merge cube border geometry");
  }

  return new THREE.Mesh(borderGeometry, material);
}

function createBorderEdgeGeometry(
  length: number,
  radius: number,
  position: THREE.Vector3,
  rotation = new THREE.Euler()
): THREE.BufferGeometry {
  const geometry = new THREE.CapsuleGeometry(
    radius,
    length,
    kBorderCapSegments,
    kBorderRadialSegments
  );
  const transform = new THREE.Matrix4().compose(
    position,
    new THREE.Quaternion().setFromEuler(rotation),
    new THREE.Vector3(1, 1, 1)
  );
  geometry.applyMatrix4(transform);

  return geometry;
}
