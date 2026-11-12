// Import Third-party Dependencies
import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod";

// Import Internal Dependencies
import type { GolemSession } from "../GolemSession.ts";
import { jsonResult } from "./results.ts";
import { ASSET_ID_FIELD } from "./asset.ts";

// CONSTANTS
const kVector = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number()
});

const kHexColor = z.string()
  .regex(/^#[0-9a-f]{6}$/)
  .describe("Lowercase hex, such as \"#ff8800\".");
const kUnit = z.number().min(0).max(1);

const kBlockSpec = z.object({
  name: z.string(),
  shape: z.union([
    z.object({
      type: z.enum(["box", "plane"])
    }),
    z.object({
      type: z.enum(["cylinder", "cone"]),
      sides: z.int()
    }),
    z.object({
      type: z.literal("torus"),
      sides: z.int(),
      ringSides: z.int(),
      thickness: z.number()
    })
  ])
    .optional()
    .describe("Default box."),
  transform: z.object({
    position: kVector.optional(),
    rotation: kVector.optional()
      .describe("Euler angles in degrees."),
    size: kVector.optional()
      .describe("In voxels. Default 1 on each axis."),
    scale: kVector.optional(),
    pivotOffset: kVector.optional()
  })
    .optional()
    .describe("Relative to the parent node, y is up."),
  material: z.string().optional()
    .describe("A material name or id.")
});

const kMaterialSpec = z.object({
  name: z.string(),
  surface: z.object({
    color: kHexColor.optional(),
    opacity: kUnit.optional(),
    roughness: kUnit.optional(),
    metalness: kUnit.optional(),
    emissive: kHexColor.optional(),
    emissiveIntensity: z.number().min(0).optional()
  })
    .optional()
    .describe("Default: white, opaque, fully rough, not metallic, no glow.")
});

export function registerVoxelModelTools(
  server: McpServer,
  session: GolemSession
): void {
  server.registerTool(
    "voxelmodel_add_blocks",
    {
      description: "Add blocks to a voxel model, and wait until the studio " +
        "accepts them. The result lists the new blocks as { id, name, uv, " +
        "shared }: uv is the rect of the block's faces on the model's " +
        "texture, to paint with pixelart_* on that texture; shared is true " +
        "when the texture was full and the faces overlap another block's.",
      inputSchema: z.object({
        assetId: ASSET_ID_FIELD,
        parent: z.string()
          .nullable()
          .optional()
          .describe("The node name or id to add under. Default: the root."),
        blocks: z.array(kBlockSpec)
      })
    },
    async({ assetId, parent, blocks }) => {
      const model = await session.open(assetId, "voxelmodel");
      const added = await model.addBlocks(blocks, { parent });
      await model.settled();

      return jsonResult({
        assetId,
        blocks: added
      });
    }
  );

  server.registerTool(
    "voxelmodel_add_materials",
    {
      description: "Add materials to a voxel model, and wait until the " +
        "studio accepts them. Blocks take a material by name or id.",
      inputSchema: z.object({
        assetId: ASSET_ID_FIELD,
        materials: z.array(kMaterialSpec)
      })
    },
    async({ assetId, materials }) => {
      const model = await session.open(assetId, "voxelmodel");
      const added = await model.addMaterials(materials);
      await model.settled();

      return jsonResult({
        assetId,
        materials: added
      });
    }
  );
}
