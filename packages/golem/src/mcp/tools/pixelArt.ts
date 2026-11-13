// Import Third-party Dependencies
import type { McpServer } from "@modelcontextprotocol/server";
import * as z from "zod";

// Import Internal Dependencies
import { MAX_READ_PIXELS } from "../../assets/pixelArt/PixelSurface.ts";
import type { GolemSession } from "../GolemSession.ts";
import { jsonResult } from "./results.ts";
import { ASSET_ID_FIELD } from "./asset.ts";

// CONSTANTS
const kColor = z.string()
  .describe("\"#rrggbb\" or \"#rrggbbaa\".");
const kRect = {
  x: z.int().min(0)
    .describe("The left column, from 0."),
  y: z.int().min(0)
    .describe("The top row, from 0."),
  width: z.int().min(1),
  height: z.int().min(1)
};
const kPaintableKinds = ["pixelart", "blockset"] as const;

export function registerPixelArtTools(
  server: McpServer,
  session: GolemSession
): void {
  server.registerTool(
    "pixelart_read_pixels",
    {
      description: "The colors of a rect of a pixelart or blockset " +
        `texture, one row per y, as "#rrggbbaa". At most ${MAX_READ_PIXELS} ` +
        "pixels. asset_read on a pixelart gives its size, palette and UV " +
        "regions; on a blockset, its tileSize and each block's " +
        "faceTextures as [col, row] tiles.",
      inputSchema: z.object({
        assetId: ASSET_ID_FIELD,
        ...kRect
      }),
      annotations: {
        readOnlyHint: true
      }
    },
    async({ assetId, ...rect }) => {
      const texture = await session.open(assetId, kPaintableKinds);

      return jsonResult(texture.pixels.readPixels(rect));
    }
  );

  server.registerTool(
    "pixelart_paint",
    {
      description: "Paint single pixels of a pixelart or blockset " +
        "texture, and wait until the studio accepts them.",
      inputSchema: z.object({
        assetId: ASSET_ID_FIELD,
        pixels: z.array(z.object({
          x: z.int().min(0),
          y: z.int().min(0),
          color: kColor
        }))
      })
    },
    async({ assetId, pixels }) => {
      const texture = await session.open(assetId, kPaintableKinds);
      const painted = await texture.pixels.paintPixels(pixels);
      await texture.settled();

      return jsonResult({
        assetId,
        painted
      });
    }
  );

  server.registerTool(
    "pixelart_fill_rect",
    {
      description: "Fill a rect of a pixelart or blockset texture with " +
        "one color, and wait until the studio accepts it.",
      inputSchema: z.object({
        assetId: ASSET_ID_FIELD,
        ...kRect,
        color: kColor
      })
    },
    async({ assetId, color, ...rect }) => {
      const texture = await session.open(assetId, kPaintableKinds);
      const painted = await texture.pixels.fillRect(rect, color);
      await texture.settled();

      return jsonResult({
        assetId,
        painted
      });
    }
  );

  server.registerTool(
    "pixelart_replace_palette",
    {
      description: "Replace the palette people pick colors from in the " +
        "pixel-art editor. It does not repaint pixels.",
      inputSchema: z.object({
        assetId: ASSET_ID_FIELD,
        colors: z.array(kColor).min(1)
      })
    },
    async({ assetId, colors }) => {
      const texture = await session.open(assetId, kPaintableKinds);
      await texture.pixels.replacePalette(colors);
      await texture.settled();

      return jsonResult({
        assetId,
        colors: colors.length
      });
    }
  );
}
