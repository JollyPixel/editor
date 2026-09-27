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
const kBloomRadius = 0.4;

/** The render step whose output the glow replaces. */
export interface GlowTarget {
  postProcessing: Systems.PostProcessing | null;
}

export interface ViewGlowOptions {
  target: GlowTarget;
  view: ViewSettingsStore;
}

export class ViewGlow {
  #target: GlowTarget;
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
    this.#strength.value = settings.glowStrength;
    this.#target.postProcessing = settings.glow ? this.#postProcessing : null;
  };

  constructor(
    options: ViewGlowOptions
  ) {
    this.#target = options.target;
    this.#unfollow = options.view.follow(this.#apply);
  }

  dispose(): void {
    this.#unfollow();
    this.#target.postProcessing = null;
  }
}
