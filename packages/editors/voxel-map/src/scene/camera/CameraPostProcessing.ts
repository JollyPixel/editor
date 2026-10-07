// Import Third-party Dependencies
import type { Systems } from "@jolly-pixel/engine";
import {
  voxelTransparencyPass,
  type VoxelTransparencyPassOptions
} from "@jolly-pixel/voxel.renderer";
import {
  emissive,
  mrt,
  output
} from "three/tsl";
import { bloom } from "three/addons/tsl/display/BloomNode.js";

// CONSTANTS
const kBloomStrength = 0.6;
const kBloomRadius = 0.2;

export class CameraPostProcessing {
  readonly #options: VoxelTransparencyPassOptions;

  readonly plain: Systems.PostProcessing = ({ scene, camera }) => voxelTransparencyPass(
    scene,
    camera,
    this.#options
  );

  readonly glow: Systems.PostProcessing = ({ scene, camera }) => {
    const scenePass = voxelTransparencyPass(
      scene,
      camera,
      this.#options
    );
    scenePass.setMRT(mrt({
      output,
      emissive
    }));

    return scenePass.add(bloom(
      scenePass.getTextureNode("emissive"),
      kBloomStrength,
      kBloomRadius
    ));
  };

  constructor(
    options: VoxelTransparencyPassOptions = {}
  ) {
    this.#options = options;
  }

  select(
    glow: boolean
  ): Systems.PostProcessing {
    return glow ? this.glow : this.plain;
  }
}
