// Import Third-party Dependencies
import type { AssetRelaySchemas } from "@jolly-pixel/asset-server";
import {
  commandVariant,
  MessageProtocol,
  withCommandHeader,
  type Infer
} from "@jolly-pixel/network";
import { scriptOutlineSchema } from "@jolly-pixel/scripting";
import * as z from "zod/mini";

// CONSTANTS
export const SCRIPT_OUTLINE_REQUESTED = "outline-requested";
export const SCRIPT_OUTLINE = "outline";

const kOffset = z.int().check(z.minimum(0));
const kChangedText = z.string().check(z.minLength(1));

export const textChangeSchema = z.union([
  z.strictObject({
    at: kOffset,
    insert: kChangedText
  }),
  z.strictObject({
    at: kOffset,
    delete: kChangedText
  })
]);

export const scriptCommandSchema = z.discriminatedUnion("action", [
  commandVariant("edited", {
    changes: z.array(textChangeSchema)
  })
]);

export const scriptCommandProtocol: MessageProtocol = new MessageProtocol(
  z.union(scriptCommandSchema.def.options.map(withCommandHeader))
);

export const scriptSnapshotSchema = z.object({
  text: z.string()
});

export const outlineRequestedSchema = z.object({
  action: z.literal(SCRIPT_OUTLINE_REQUESTED)
});

export const outlineMessageSchema = z.object({
  type: z.literal(SCRIPT_OUTLINE),
  outline: scriptOutlineSchema
});

export type ScriptOutlineRequest = Infer<typeof outlineRequestedSchema>;
export type ScriptOutlineMessage = Infer<typeof outlineMessageSchema>;

export const SCRIPT_RELAY_SCHEMAS: AssetRelaySchemas<ScriptOutlineRequest> = {
  inbound: [outlineRequestedSchema],
  outbound: [outlineMessageSchema]
};
