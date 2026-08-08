// Import Third-party Dependencies
import {
  type Actor,
  ActorComponent
} from "@jolly-pixel/engine";
import * as THREE from "three";
import type {
  UVFace,
  UVGeometry,
  UVRegion,
  Vec2
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import type { PreviewShape } from "./PreviewShape.ts";
import {
  applyUvGeometry,
  applyUvRect
} from "./applyUvGeometry.ts";
import { resolvePreviewShape } from "./resolvePreviewShape.ts";

// CONSTANTS
const kRotationSpeedX = 0.3;
const kRotationSpeedY = 0.6;
const kPositionLerpRate = 6;

export interface RegionPreviewBehaviorOptions {
  canvasTexture: THREE.CanvasTexture;
  region: UVRegion;
  textureSize: Vec2;
}

export interface RegionPreview {
  readonly mesh: THREE.Mesh;
  readonly rotation: THREE.Euler;
  applyRegion(region: UVRegion, textureSize: Vec2): void;
  applyFace(
    face: UVFace | null,
    geometry: UVGeometry,
    textureSize: Vec2
  ): void;
  setTargetPosition(position: THREE.Vector3): void;
  setSelected(selected: boolean): void;
  setBorderColor(color: THREE.ColorRepresentation): void;
  setRotating(rotating: boolean): void;
  setRotation(rotation: THREE.Euler): void;
}

export class RegionPreviewBehavior extends ActorComponent implements RegionPreview {
  readonly mesh: THREE.Mesh;

  readonly #shape: PreviewShape;
  readonly #baseUv: Float32Array;
  readonly #borderMaterial: THREE.MeshBasicMaterial;
  readonly #selectionColor: THREE.Color;
  readonly #borderColor = new THREE.Color(0x101820);
  readonly #targetPosition: THREE.Vector3;
  #selected = false;
  #rotating = true;

  constructor(
    actor: Actor,
    options: RegionPreviewBehaviorOptions
  ) {
    super({
      actor,
      typeName: "RegionPreviewBehavior"
    });

    const { canvasTexture, region, textureSize } = options;
    this.#borderMaterial = new THREE.MeshBasicMaterial({
      color: this.#borderColor,
      toneMapped: false
    });
    this.#shape = resolvePreviewShape(region, this.#borderMaterial);
    this.#baseUv = Float32Array.from(
      this.#shape.geometry.getAttribute("uv").array
    );
    this.#selectionColor = new THREE.Color(region.color);

    this.mesh = new THREE.Mesh(
      this.#shape.geometry,
      new THREE.MeshStandardMaterial({
        map: canvasTexture,
        transparent: true
      })
    );
    this.mesh.userData.regionId = region.id;
    this.applyRegion(region, textureSize);

    this.actor.addChildren(
      this.mesh,
      ...this.#shape.decorations
    );
    this.#targetPosition = this.actor.object3D.position.clone();
  }

  get rotation(): THREE.Euler {
    return this.actor.object3D.rotation;
  }

  setTargetPosition(
    position: THREE.Vector3
  ): void {
    this.#targetPosition.copy(position);
  }

  applyRegion(
    region: UVRegion,
    textureSize: Vec2
  ): void {
    for (const { face, geometry } of region.facesOf()) {
      this.applyFace(face, geometry, textureSize);
    }
  }

  applyFace(
    face: UVFace | null,
    geometry: UVGeometry,
    textureSize: Vec2
  ): void {
    const uvAttribute = this.mesh.geometry.getAttribute("uv");

    if (face === null) {
      applyUvRect({
        uvAttribute,
        baseUv: this.#baseUv,
        rect: "shape" in geometry ? geometry.rect : geometry,
        textureSize,
        range: {
          start: 0,
          count: this.#baseUv.length / 2
        }
      });
    }
    else {
      const range = this.#shape.faceRanges[face];
      if (!range) {
        return;
      }
      applyUvGeometry(
        uvAttribute,
        this.#baseUv,
        geometry,
        textureSize,
        range
      );
    }

    uvAttribute.needsUpdate = true;
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

  update(
    deltaTime: number
  ): void {
    if (this.#rotating) {
      this.actor.object3D.rotation.x += kRotationSpeedX * deltaTime;
      this.actor.object3D.rotation.y += kRotationSpeedY * deltaTime;
    }

    const alpha = 1 - Math.exp(-kPositionLerpRate * deltaTime);
    this.actor.object3D.position.lerp(
      this.#targetPosition,
      alpha
    );
  }

  #syncBorderColor(): void {
    this.#borderMaterial.color.copy(
      this.#selected ? this.#selectionColor : this.#borderColor
    );
  }
}
