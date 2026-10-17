// Import Third-party Dependencies
import type { Systems } from "@jolly-pixel/engine";
import {
  emissive,
  mrt,
  output,
  pass,
  uniform
} from "three/tsl";
import { bloom } from "three/addons/tsl/display/BloomNode.js";

// Import Internal Dependencies
import type {
  ViewSettings,
  ViewSettingsStore
} from "../state/index.ts";

// CONSTANTS
const kBloomStrength = 1;
const kBloomRadius = 0.4;

export interface GlowTarget {
  postProcessing: Systems.PostProcessing | null;
}

export interface ViewGlowOptions {
  target: GlowTarget;
  view: ViewSettingsStore;
  glows: () => boolean;
}

export class ViewGlow {
  #target: GlowTarget;
  #glows: () => boolean;
  #unfollow: () => void;
  #strength = uniform(1);

  readonly #postProcessing: Systems.PostProcessing = ({ scene, camera }) => {
    const scenePass = pass(scene, camera);
    scenePass.setMRT(mrt({
      output,
      emissive
    }));

    const glow = bloom(
      scenePass.getTextureNode("emissive"),
      this.#strength,
      kBloomRadius
    );

    return scenePass.getTextureNode("output").add(glow);
  };

  #apply = (
    settings: ViewSettings
  ): void => {
    this.#strength.value = settings.glow ? kBloomStrength : 0;
  };

  constructor(
    options: ViewGlowOptions
  ) {
    this.#target = options.target;
    this.#glows = options.glows;
    this.#unfollow = options.view.follow(this.#apply);
    this.update();
  }

  readonly update = (): void => {
    this.#target.postProcessing = this.#glows() ? this.#postProcessing : null;
  };

  dispose(): void {
    this.#unfollow();
    this.#target.postProcessing = null;
  }
}
