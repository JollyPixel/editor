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
  SceneGlowFile
} from "../../../core/systems/scene/file/SceneFile.ts";

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
    glow: Readonly<SceneGlowFile>
  ): PostProcessing {
    this.#strength.value = glow.strength;
    this.#radius.value = glow.radius;

    return this.#postProcessing;
  }
}
