// Import Internal Dependencies
import { defineSchema } from "../protocol/schema.ts";

export const commandHeaderProperties = {
  clientId: { type: "string" },
  seq: { type: "number" },
  timestamp: { type: "number" }
} as const;

export const COMMAND_HEADER_REQUIRED = [
  "clientId",
  "seq",
  "timestamp"
] as const;

export const networkCommandHeaderSchema = defineSchema({
  type: "object",
  properties: commandHeaderProperties,
  required: COMMAND_HEADER_REQUIRED
});
