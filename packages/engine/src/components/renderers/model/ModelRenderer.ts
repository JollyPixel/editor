// Import Third-party Dependencies
import type { AssetReference } from "@jolly-pixel/asset";
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import { Actor, ActorComponent } from "../../../actor/index.ts";
import { type Model } from "./loader.ts";

import {
  ModelAnimation,
  type ModelAnimationClipNameRewriter
} from "./ModelAnimation.ts";

export interface ModelRendererAnimationOptions<
  TClipName extends string = string
> {
  clipNameRewriter?: ModelAnimationClipNameRewriter;
  default?: TClipName;
  fadeDuration?: number;
}

export interface ModelRendererOptions<
  TClipName extends string = string
> {
  asset: AssetReference<Model>;
  /**
   * @default false
   */
  debug?: boolean;
  animations?: ModelRendererAnimationOptions<TClipName>;
}

/**
 * Attaches a prepared model asset to an actor during awake.
 */
export class ModelRenderer<
  TClipName extends string = string
> extends ActorComponent<any> {
  group: THREE.Group<THREE.Object3DEventMap>;

  #asset: AssetReference<Model>;
  #debug = false;

  animation = new ModelAnimation<TClipName>();

  constructor(
    actor: Actor<any>,
    options: ModelRendererOptions<TClipName>
  ) {
    super({
      actor,
      typeName: "ModelRenderer"
    });

    this.#asset = options.asset;
    this.#debug = options.debug ?? false;

    const { animations } = options;
    if (animations) {
      if (animations.fadeDuration !== undefined) {
        this.animation.setFadeDuration(animations.fadeDuration);
      }
      if (animations.clipNameRewriter) {
        this.animation.setClipNameRewriter(animations.clipNameRewriter);
      }
      if (animations.default) {
        this.animation.play(animations.default);
      }
    }
    else {
      this.needUpdate = false;
    }
  }

  awake() {
    const { object, animations } = this.getAsset(this.#asset);
    if (this.#debug) {
      console.log({ object, animations });
    }

    this.actor.addChildren(object);
    this.group = object;

    this.animation.setMixer(
      new THREE.AnimationMixer(this.group)
    );
    this.animation.setClips(animations);
  }

  start() {
    this.animation.start();
  }

  update(
    deltaTime: number
  ) {
    this.animation.update(deltaTime);
  }
}
