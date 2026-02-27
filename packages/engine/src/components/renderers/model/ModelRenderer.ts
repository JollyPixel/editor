// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import * as Systems from "../../../systems/index.ts";
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
  path: string;
  /**
   * @default false
   */
  debug?: boolean;
  animations?: ModelRendererAnimationOptions<TClipName>;
}

export class ModelRenderer<
  TClipName extends string = string
> extends ActorComponent<any> {
  group: THREE.Group<THREE.Object3DEventMap>;

  #asset: Systems.LazyAsset<Model>;
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

    this.#asset = actor.world.assetManager.load<Model>(options.path);
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
    const { object, animations } = this.#asset.get();
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
