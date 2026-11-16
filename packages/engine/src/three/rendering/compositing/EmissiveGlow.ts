// Import Third-party Dependencies
import {
  emissive,
  mrt,
  output,
  pass,
  uniform
} from "three/tsl";
import { bloom } from "three/addons/tsl/display/BloomNode.js";

// Import Internal Dependencies
import type { PostProcessing } from "./PostProcessing.ts";
import type {
  EnvironmentGlowFile
} from "../../../core/systems/environment/EnvironmentFile.ts";

export class EmissiveGlow {
  readonly #strength = uniform(1);
  readonly #radius = uniform(0);

  readonly #postProcessing: PostProcessing = ({ scene, camera }) => {
    const scenePass = pass(scene, camera);
    scenePass.setMRT(mrt({
      output,
      emissive
    }));

    return scenePass.getTextureNode("output").add(bloom(
      scenePass.getTextureNode("emissive"),
      this.#strength,
      this.#radius
    ));
  };

  apply(
    glow: Readonly<EnvironmentGlowFile>
  ): PostProcessing {
    this.#strength.value = glow.strength;
    this.#radius.value = glow.radius;

    return this.#postProcessing;
  }
}
