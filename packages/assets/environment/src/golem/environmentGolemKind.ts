// Import Third-party Dependencies
import {
  golemIntent,
  golemKind
} from "@jolly-pixel/golem.kit";

// Import Internal Dependencies
import { environmentEditableKind } from "../network/environmentEditableKind.ts";
import { EnvironmentAsset } from "./EnvironmentAsset.ts";
import { environmentChangeSchema } from "./EnvironmentPatch.ts";

// CONSTANTS
const kGuide = new URL("./guide.md", import.meta.url);

export const ENVIRONMENT_GOLEM_KIND = golemKind(
  environmentEditableKind(),
  EnvironmentAsset,
  {
    guide: kGuide,
    intents: {
      change: golemIntent({
        description: "Change the sky, sun, ambient light, reflections, fog, " +
          "tone mapping, glow or voxel shading. Each section is partial: " +
          "fields left out keep their value. Changing a section's kind fills " +
          "the new kind's defaults. Answers the sections that changed.",
        input: environmentChangeSchema,
        run: (asset: EnvironmentAsset, input) => asset.change(input)
      })
    }
  }
);
