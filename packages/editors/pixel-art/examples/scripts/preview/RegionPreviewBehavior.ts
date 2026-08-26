// Import Third-party Dependencies
import {
  type Actor,
  ActorComponent
} from "@jolly-pixel/engine";
import * as THREE from "three";
import type {
  UVMap,
  UVRegion,
  Vec2
} from "@jolly-pixel/pixel-draw.renderer";

// Import Internal Dependencies
import { UVGeometryBinding } from "../../../src/three/UVGeometryBinding.ts";
import type { PreviewShape } from "./PreviewShape.ts";
import { resolvePreviewShape } from "./resolvePreviewShape.ts";

// CONSTANTS
const kRotationSpeedX = 0.3;
const kRotationSpeedY = 0.6;
const kPositionLerpRate = 6;

export interface RegionPreviewBehaviorOptions {
  canvasTexture: THREE.Texture;
  region: UVRegion;
  textureSize: Vec2;
}

/**
 * Preview controls; UV projection stays in UVGeometryBinding.
 */
export interface RegionPreview {
  readonly mesh: THREE.Mesh;
  readonly rotation: THREE.Euler;
  follow(uv: UVMap): void;
  setTextureSize(size: Vec2): void;
  setTargetPosition(position: THREE.Vector3): void;
  setSelected(selected: boolean): void;
  setBorderColor(color: THREE.ColorRepresentation): void;
  setRotating(rotating: boolean): void;
  setRotation(rotation: THREE.Euler): void;
}

export class RegionPreviewBehavior extends ActorComponent implements RegionPreview {
  readonly mesh: THREE.Mesh;

  readonly #shape: PreviewShape;
  readonly #binding: UVGeometryBinding;
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
    this.#selectionColor = new THREE.Color(region.color);

    this.mesh = new THREE.Mesh(
      this.#shape.geometry,
      new THREE.MeshStandardMaterial({
        map: canvasTexture,
        transparent: true
      })
    );
    this.mesh.userData.regionId = region.id;

    // The binding snapshots the new geometry's untouched UVs.
    this.#binding = new UVGeometryBinding({
      geometry: this.#shape.geometry,
      region,
      textureSize,
      faceRanges: this.#shape.faceRanges
    });

    this.actor.addChildren(
      this.mesh,
      ...this.#shape.decorations
    );
    this.#targetPosition = this.actor.object3D.position.clone();
  }

  get rotation(): THREE.Euler {
    return this.actor.object3D.rotation;
  }

  follow(
    uv: UVMap
  ): void {
    this.#binding.follow(uv);
  }

  setTextureSize(
    size: Vec2
  ): void {
    this.#binding.setTextureSize(size);
  }

  setTargetPosition(
    position: THREE.Vector3
  ): void {
    this.#targetPosition.copy(position);
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

  override destroy(): void {
    this.#binding.unfollow();
    super.destroy();
  }

  #syncBorderColor(): void {
    this.#borderMaterial.color.copy(
      this.#selected ? this.#selectionColor : this.#borderColor
    );
  }
}
