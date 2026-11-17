// Import Third-party Dependencies
import {
  golemIntent,
  golemKind
} from "@jolly-pixel/golem.kit";
import * as z from "zod/mini";

// Import Internal Dependencies
import { ENVIRONMENT_PRESET_NAMES } from "../asset/environment.ts";
import { environmentEditableKind } from "../network/environmentEditableKind.ts";
import { EnvironmentAsset } from "./EnvironmentAsset.ts";
import { environmentPatchSchema } from "./EnvironmentPatch.ts";

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
          "the new kind's defaults. Answers the sections that changed and " +
          "the file.",
        input: z.extend(environmentPatchSchema, {
          preset: z.optional(z.enum(ENVIRONMENT_PRESET_NAMES).check(
            z.describe("Start every section from this preset, then apply " +
              "the sections given.")
          ))
        }),
        run: async(asset: EnvironmentAsset, { preset, ...patch }) => {
          const changed = await asset.change(patch, { preset });

          return {
            changed,
            environment: asset.read()
          };
        }
      })
    }
  }
);
