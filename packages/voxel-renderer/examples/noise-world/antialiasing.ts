// Import Third-party Dependencies
import type { Systems } from "@jolly-pixel/engine";
import {
  mrt,
  output,
  pass,
  velocity
} from "three/tsl";
import { traa } from "three/addons/tsl/display/TRAANode.js";

export function temporalAntialiasing(): Systems.PostProcessing {
  return ({ scene, camera }) => {
    const scenePass = pass(scene, camera, { samples: 0 });
    scenePass.setMRT(mrt({
      output,
      velocity
    }));

    return traa(
      scenePass.getTextureNode("output"),
      scenePass.getTextureNode("depth"),
      scenePass.getTextureNode("velocity"),
      camera
    );
  };
}
