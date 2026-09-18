// Import Third-party Dependencies
import type { AssetReference } from "@jolly-pixel/asset";
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { type Actor, ActorComponent } from "../../../actor/index.ts";
import {
  SpriteAnimation,
  type SpriteAnimationOptions
} from "./SpriteAnimation.ts";

export interface SpriteRendererOptions {
  texture: AssetReference<THREE.Texture>;
  tileHorizontal: number;
  tileVertical: number;
  animations?: SpriteAnimationOptions;
  flip?: {
    horizontal?: boolean;
    vertical?: boolean;
  };
}

export class SpriteRenderer extends ActorComponent<any> {
  frameIndex = 0;
  tileHorizontal: number;
  tileVertical: number;
  flip = {
    horizontal: false,
    vertical: false
  };

  texture: THREE.Texture | null = null;
  animation: SpriteAnimation;
  threeObject: THREE.Sprite;

  #asset: AssetReference<THREE.Texture>;

  constructor(
    actor: Actor<any>,
    options: SpriteRendererOptions
  ) {
    super({
      actor,
      typeName: "SpriteRenderer"
    });
    const {
      texture,
      tileHorizontal,
      tileVertical,
      animations = {},
      flip = {}
    } = options;

    this.#asset = texture;
    this.tileHorizontal = tileHorizontal;
    this.tileVertical = tileVertical;
    this.flip.horizontal = flip.horizontal ?? false;
    this.flip.vertical = flip.vertical ?? false;

    this.animation = new SpriteAnimation(animations);
    this.threeObject = new THREE.Sprite(new THREE.SpriteMaterial());
  }

  awake() {
    this.texture = this.getAsset(this.#asset).clone();
    this.threeObject.material.map = this.texture;
    this.threeObject.material.needsUpdate = true;
    this.#applyUVs();
  }

  setHorizontalFlip(
    value: boolean
  ) {
    this.flip.horizontal = value;
    this.#applyUVs();
  }

  setVerticalFlip(
    value: boolean
  ) {
    this.flip.vertical = value;
    this.#applyUVs();
  }

  setOpacity(
    opacity: number
  ) {
    this.threeObject.material.transparent = true;
    this.threeObject.material.opacity = opacity;
    this.threeObject.material.needsUpdate = true;
  }

  start() {
    this.actor.object3D.add(this.threeObject);
    this.threeObject.updateMatrixWorld(false);
    this.setFrame(0);
  }

  setFrame(
    index: number
  ) {
    this.frameIndex = index;
    this.#applyUVs();
  }

  #applyUVs(): void {
    if (this.texture === null) {
      return;
    }

    const { horizontal, vertical } = this.flip;
    const tileX = this.frameIndex % this.tileHorizontal;
    const tileY = this.tileVertical - Math.floor(this.frameIndex / this.tileHorizontal) - 1;

    this.texture.repeat.set(
      (horizontal ? -1 : 1) / this.tileHorizontal,
      (vertical ? -1 : 1) / this.tileVertical
    );
    this.texture.offset.set(
      (horizontal ? tileX + 1 : tileX) / this.tileHorizontal,
      (vertical ? tileY + 1 : tileY) / this.tileVertical
    );
  }

  update(
    deltaTime: number
  ) {
    const frame = this.animation.update(deltaTime);
    if (frame !== null) {
      this.setFrame(frame);
    }
  }

  protected override onDestroy() {
    this.actor.object3D.remove(this.threeObject);
    this.texture?.dispose();
    this.threeObject.material.dispose();
  }
}

export type { SpriteAnimationOptions };
