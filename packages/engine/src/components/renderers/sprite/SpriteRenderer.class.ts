// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import { Actor, ActorComponent } from "../../../actor/index.ts";
import {
  SpriteAnimation,
  type SpriteAnimationOptions
} from "./SpriteAnimation.class.ts";

export interface SpriteRendererOptions {
  texture: string;
  tileHorizontal: number;
  tileVertical: number;
  animations?: SpriteAnimationOptions;
  flip?: {
    horizontal?: boolean;
    vertical?: boolean;
  };
}

export class SpriteRenderer extends ActorComponent<any> {
  frameIndex: number;
  tileHorizontal: number;
  tileVertical: number;
  flip = {
    horizontal: false,
    vertical: false
  };

  texture: THREE.Texture;
  animation: SpriteAnimation;
  threeObject: THREE.Sprite;

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

    this.tileHorizontal = tileHorizontal;
    this.tileVertical = tileVertical;

    this.texture = new THREE.TextureLoader().load(texture);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.minFilter = THREE.NearestFilter;

    this.setHorizontalFlip(flip.horizontal ?? false);
    this.setVerticalFlip(flip.vertical ?? false);

    this.animation = new SpriteAnimation(animations);
    const material = new THREE.SpriteMaterial({
      map: this.texture
    });
    this.threeObject = new THREE.Sprite(material);
  }

  setHorizontalFlip(
    value: boolean
  ) {
    this.flip.horizontal = value;
    this.texture.repeat.x = (value ? -1 : 1) / this.tileHorizontal;
  }

  setVerticalFlip(
    value: boolean
  ) {
    this.flip.vertical = value;
    this.texture.repeat.y = (value ? -1 : 1) / this.tileVertical;
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
    const tileX = index % this.tileHorizontal;
    const tileY = this.tileVertical - Math.floor(index / this.tileHorizontal) - 1;

    const x = (this.flip.horizontal ? tileX + 1 : tileX) / this.tileHorizontal;
    const y = (this.flip.vertical ? tileY + 1 : tileY) / this.tileVertical;

    this.frameIndex = index;
    this.texture.offset.set(x, y);
  }

  update() {
    const frame = this.animation.update();
    if (frame) {
      this.setFrame(frame);
    }
  }

  override destroy() {
    this.actor.object3D.remove(this.threeObject);
    this.texture.dispose();
    this.threeObject.clear();

    super.destroy();
  }
}

export type { SpriteAnimationOptions };
