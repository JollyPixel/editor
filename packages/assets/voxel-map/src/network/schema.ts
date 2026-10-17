// Import Third-party Dependencies
import {
  commandVariant,
  withCommandHeader
} from "@jolly-pixel/network";
import { MAX_TILE_SIZE } from "@jolly-pixel/voxel.renderer";
import * as z from "zod/mini";

export const tileSizeSchema = z.int().check(
  z.minimum(1),
  z.maximum(MAX_TILE_SIZE)
);

export const anyObjectSchema = z.record(z.string(), z.unknown());

export function networkCommand(
  action: string,
  properties: z.core.$ZodLooseShape
): z.ZodMiniObject {
  return withCommandHeader(commandVariant(action, properties));
}
