// Import Third-party Dependencies
import type { AssetReference } from "@jolly-pixel/asset";
import * as THREE from "three/webgpu";
import { clone as cloneSkinned } from "three/addons/utils/SkeletonUtils.js";

// Import Internal Dependencies
import { type Actor, ActorComponent } from "../../../actor/index.ts";
import type { Model } from "../../../assets/model.ts";
import type {
  Shader,
  ShaderUniformValues
} from "../../../assets/shader.ts";
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

export type ModelSource =
  | {
    /**
     * Model resolved from the world's asset coordinator when the actor awakes.
     */
    asset: AssetReference<Model>;
    model?: never;
  }
  | {
    model: Model;
    asset?: never;
  };

export type ModelRendererOptions<
  TClipName extends string = string
> = ModelSource & {
  /**
   * @default false
   */
  debug?: boolean;
  /**
   * Omitted, every mesh keeps the flag set by the model loader.
   */
  castShadow?: boolean;
  /**
   * Omitted, every mesh keeps the flag set by the model loader.
   */
  receiveShadow?: boolean;
  /**
   * Builds one material that replaces the material of every mesh.
   * @default null
   */
  shader?: Shader | null;
  /**
   * Values passed to the shader; a missing uniform keeps its declared default.
   * @default {}
   */
  uniforms?: ShaderUniformValues;
  animations?: ModelRendererAnimationOptions<TClipName>;
};

export class ModelRenderer<
  TClipName extends string = string
> extends ActorComponent<any> {
  group: THREE.Group<THREE.Object3DEventMap>;

  #source: ModelSource;
  #debug = false;
  #castShadow: boolean | undefined;
  #receiveShadow: boolean | undefined;
  #shader: Shader | null;
  #uniforms: ShaderUniformValues;
  #material: THREE.Material | null = null;
  #mixer: THREE.AnimationMixer | null = null;

  animation = new ModelAnimation<TClipName>(() => {
    this.needUpdate = true;
  });

  constructor(
    actor: Actor<any>,
    options: ModelRendererOptions<TClipName>
  ) {
    super({
      actor,
      typeName: "ModelRenderer",
      needUpdate: false
    });

    this.#source = options;
    this.#debug = options.debug ?? false;
    this.#castShadow = options.castShadow;
    this.#receiveShadow = options.receiveShadow;
    this.#shader = options.shader ?? null;
    this.#uniforms = options.uniforms ?? {};

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
  }

  awake() {
    const { object, animations } = this.#source.model ??
      this.getAsset(this.#source.asset);
    if (this.#debug) {
      console.log({ object, animations });
    }

    this.group = cloneSkinned(object) as THREE.Group<THREE.Object3DEventMap>;
    const material = this.#shader?.createMaterial(this.#uniforms).material ?? null;
    this.#material = material;
    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = this.#castShadow ?? child.castShadow;
        child.receiveShadow = this.#receiveShadow ?? child.receiveShadow;
        if (material !== null) {
          child.material = material;
        }
      }
    });
    this.actor.addChildren(this.group);

    this.#mixer = new THREE.AnimationMixer(this.group);
    this.animation.setMixer(this.#mixer);
    this.animation.setClips(animations);
  }

  start() {
    this.animation.start();
  }

  update(
    deltaTime: number
  ) {
    this.animation.update(deltaTime);
    if (!this.animation.isAnimating) {
      this.needUpdate = false;
    }
  }

  protected override onDestroy(): void {
    this.#mixer?.stopAllAction();
    this.#mixer?.uncacheRoot(this.group);
    this.group?.removeFromParent();
    this.#material?.dispose();
    this.#material = null;
  }
}
