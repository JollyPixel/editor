// Import Third-party Dependencies
import * as THREE from "three";

// Import Internal Dependencies
import * as Systems from "../../../systems/index.ts";
import { Actor, ActorComponent } from "../../../actor/index.ts";
import { model, type Model } from "./loader.ts";

import {
  ModelAnimation,
  type ModelAnimationClipNameRewriter
} from "./ModelAnimation.ts";

export interface ModelRendererAnimationOptions {
  clipNameRewriter?: ModelAnimationClipNameRewriter;
  default?: string;
}

export interface ModelRendererOptions {
  path: string;
  /**
   * @default false
   */
  debug?: boolean;
  animations?: ModelRendererAnimationOptions;
}

export class ModelRenderer extends ActorComponent<any> {
  #asset: Systems.LazyAsset<Model>;
  #object: THREE.Group<THREE.Object3DEventMap>;
  #debug = false;

  animation = new ModelAnimation();

  constructor(
    actor: Actor<any>,
    options: ModelRendererOptions
  ) {
    super({
      actor,
      typeName: "ModelRenderer"
    });

    this.#asset = model(options.path);
    this.#debug = options.debug ?? false;

    const { animations = {} } = options;
    if (animations.default) {
      this.animation.play(animations.default);
    }
    if (animations.clipNameRewriter) {
      this.animation.setClipNameRewriter(animations.clipNameRewriter);
    }
  }

  awake() {
    const { object, animations } = this.#asset.get();
    if (this.#debug) {
      console.log({ object, animations });
    }

    this.actor.threeObject.add(object);
    this.#object = object;
    this.animation.setMixer(
      new THREE.AnimationMixer(this.#object)
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

  override destroy(): void {
    this.actor.threeObject.remove(this.#object);
    super.destroy();
  }
}
