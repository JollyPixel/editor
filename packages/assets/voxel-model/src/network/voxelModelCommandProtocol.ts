// Import Third-party Dependencies
import {
  MessageProtocol,
  withCommandHeader
} from "@jolly-pixel/network";
import * as z from "zod/mini";

// Import Internal Dependencies
import { voxelModelCommandSchema } from "./VoxelModelCommand.schema.ts";

export const voxelModelCommandProtocol: MessageProtocol = new MessageProtocol(
  z.union(voxelModelCommandSchema.def.options.map(withCommandHeader))
);
