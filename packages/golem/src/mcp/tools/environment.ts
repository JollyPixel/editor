// Import Third-party Dependencies
import { ENVIRONMENT_PRESET_NAMES } from "@jolly-pixel/asset.environment/client";
import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod";

// Import Internal Dependencies
import type { GolemSession } from "../GolemSession.ts";
import { jsonResult } from "./results.ts";
import { ASSET_ID_FIELD } from "./asset.ts";

// CONSTANTS
const kColor = z.string()
  .describe("Hex, such as \"#ffd9a0\".");
const kIntensity = z.number()
  .min(0);

const kSky = z.object({
  kind: z.enum(["none", "color", "day", "night"])
    .optional()
    .describe("none clears to the renderer's color; day and night are " +
      "procedural skies lit along the sun direction."),
  color: kColor.optional()
    .describe("Only for kind color.")
});

const kSun = z.object({
  color: kColor.optional(),
  intensity: kIntensity.optional(),
  azimuth: z.number()
    .optional()
    .describe("Degrees around +Y, from +Z toward +X."),
  elevation: z.number()
    .min(-90)
    .max(90)
    .optional()
    .describe("Degrees above the horizon.")
});

const kAmbient = z.object({
  skyColor: kColor.optional(),
  groundColor: kColor.optional(),
  intensity: kIntensity.optional()
});

const kReflections = z.object({
  kind: z.enum(["none", "room"]).optional(),
  intensity: kIntensity.optional()
});

const kFog = z.object({
  kind: z.enum(["none", "linear", "exp2"]).optional(),
  color: kColor.optional(),
  near: z.number()
    .min(0)
    .optional()
    .describe("World units, for kind linear."),
  far: z.number()
    .min(0)
    .optional()
    .describe("World units, for kind linear."),
  density: z.number()
    .min(0)
    .optional()
    .describe("For kind exp2, such as 0.02.")
});

const kToneMapping = z.object({
  kind: z.enum(["none", "neutral", "aces", "agx"]).optional(),
  exposure: kIntensity.optional()
});

const kGlow = z.object({
  strength: kIntensity.optional(),
  radius: z.number()
    .min(0)
    .max(1)
    .optional()
});

const kVoxel = z.object({
  blockLightFalloff: z.enum(["wide", "focused"]).optional(),
  shadowFill: kIntensity.optional()
    .describe("How much block light fills shadows.")
});

export function registerEnvironmentTools(
  server: McpServer,
  session: GolemSession
): void {
  server.registerTool(
    "environment_change",
    {
      description: "Change an environment asset (sky, sun, ambient light, " +
        "reflections, fog, tone mapping, glow, voxel shading) and wait " +
        "until the studio accepts it. Each section is partial: fields left " +
        "out keep their value. Changing a section's kind fills the new " +
        "kind's defaults. Answers the sections that changed and the file.",
      inputSchema: z.object({
        assetId: ASSET_ID_FIELD,
        preset: z.enum(ENVIRONMENT_PRESET_NAMES)
          .optional()
          .describe("Start every section from this preset, then apply the " +
            "sections given."),
        sky: kSky.optional(),
        sun: kSun.nullable()
          .optional()
          .describe("A directional light. null turns it off."),
        ambient: kAmbient.optional()
          .describe("A hemisphere light; equal colors give a flat light."),
        reflections: kReflections.optional(),
        fog: kFog.optional(),
        toneMapping: kToneMapping.optional(),
        glow: kGlow.nullable()
          .optional()
          .describe("Bloom on emissive and bright surfaces. null turns it off."),
        voxel: kVoxel.optional()
          .describe("Read by voxel maps and voxel models only.")
      })
    },
    async({ assetId, preset, ...patch }) => {
      const environment = await session.open(assetId, "environment");
      const changed = await environment.change(patch, { preset });
      await environment.settled();

      return jsonResult({
        assetId,
        changed,
        environment: environment.read()
      });
    }
  );
}
