// Import Third-party Dependencies
import type { AssetReference } from "@jolly-pixel/asset";
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { type Actor, ActorComponent } from "../../../actor/index.ts";
import {
  SpriteAnimation,
  type SpriteAnimationOptions
} from "./SpriteAnimation.ts";
import {
  SpriteSheet,
  type SpriteFlip
} from "./SpriteSheet.ts";

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
  readonly sheet: SpriteSheet;

  texture: THREE.Texture | null = null;
  animation: SpriteAnimation;
  threeObject: THREE.Sprite;

  #asset: AssetReference<THREE.Texture>;
  #frameIndex = 0;
  #flip: SpriteFlip;

  constructor(
    actor: Actor<any>,
    options: SpriteRendererOptions
  ) {
    super({
      actor,
      typeName: "SpriteRenderer",
      needUpdate: false
    });
    const {
      texture,
      tileHorizontal,
      tileVertical,
      animations = {},
      flip = {}
    } = options;

    this.#asset = texture;
    this.sheet = new SpriteSheet(tileHorizontal, tileVertical);
    this.#flip = {
      horizontal: flip.horizontal ?? false,
      vertical: flip.vertical ?? false
    };

    this.animation = new SpriteAnimation(
      animations,
      () => {
        this.needUpdate = true;
      },
      actor.world.logger
    );
    this.threeObject = new THREE.Sprite(new THREE.SpriteMaterial());
  }

  awake() {
    this.texture = this.getAsset(this.#asset).clone();
    this.threeObject.material.map = this.texture;
    this.threeObject.material.needsUpdate = true;
    this.#applyUVs();
  }

  get frameIndex(): number {
    return this.#frameIndex;
  }

  get flip(): Readonly<SpriteFlip> {
    return this.#flip;
  }

  setHorizontalFlip(
    value: boolean
  ) {
    this.#flip.horizontal = value;
    this.#applyUVs();
  }

  setVerticalFlip(
    value: boolean
  ) {
    this.#flip.vertical = value;
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
    this.#frameIndex = index;
    this.#applyUVs();
  }

  #applyUVs(): void {
    if (this.texture !== null) {
      this.sheet.writeFrame(this.texture, this.#frameIndex, this.#flip);
    }
  }

  update(
    deltaTime: number
  ) {
    const frame = this.animation.update(deltaTime);
    if (frame !== null) {
      this.setFrame(frame);
    }
    if (!this.animation.isPlaying) {
      this.needUpdate = false;
    }
  }

  protected override onDestroy() {
    this.actor.object3D.remove(this.threeObject);
    this.texture?.dispose();
    this.threeObject.material.dispose();
  }
}

export type { SpriteAnimationOptions };
