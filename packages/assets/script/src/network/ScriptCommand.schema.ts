// Import Third-party Dependencies
import type { AssetRelaySchemas } from "@jolly-pixel/asset-server";
import {
  commandVariant,
  MessageProtocol,
  withCommandHeader,
  type Infer
} from "@jolly-pixel/network";
import {
  scriptDiagnosticSchema,
  scriptOutlineSchema
} from "@jolly-pixel/scripting";
import * as z from "zod/mini";

// Import Internal Dependencies
import { MAX_INDENT_WIDTH } from "../model/TextFormat.ts";

// CONSTANTS
export const SCRIPT_OUTLINE_REQUESTED = "outline-requested";
export const SCRIPT_OUTLINE = "outline";
export const SCRIPT_LINT_REQUESTED = "lint-requested";
export const SCRIPT_LINT = "lint";

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

const kIndentWidth = z.int().check(z.minimum(1), z.maximum(MAX_INDENT_WIDTH));

export const textFormatSchema = z.object({
  indentStyle: z.enum(["tab", "space"]),
  indentSize: kIndentWidth,
  tabWidth: kIndentWidth
});

export const scriptSnapshotSchema = z.object({
  text: z.string(),
  format: textFormatSchema
});

export const outlineRequestedSchema = z.object({
  action: z.literal(SCRIPT_OUTLINE_REQUESTED)
});

export const outlineMessageSchema = z.object({
  type: z.literal(SCRIPT_OUTLINE),
  outline: scriptOutlineSchema
});

export const lintRequestedSchema = z.object({
  action: z.literal(SCRIPT_LINT_REQUESTED)
});

export const lintMessageSchema = z.object({
  type: z.literal(SCRIPT_LINT),
  fingerprint: z.string(),
  diagnostics: z.array(scriptDiagnosticSchema)
});

export type ScriptOutlineRequest = Infer<typeof outlineRequestedSchema>;
export type ScriptOutlineMessage = Infer<typeof outlineMessageSchema>;
export type ScriptLintRequest = Infer<typeof lintRequestedSchema>;
export type ScriptLintMessage = Infer<typeof lintMessageSchema>;
export type ScriptRelayRequest = ScriptOutlineRequest | ScriptLintRequest;

export const SCRIPT_RELAY_SCHEMAS: AssetRelaySchemas<ScriptRelayRequest> = {
  inbound: [outlineRequestedSchema, lintRequestedSchema],
  outbound: [outlineMessageSchema, lintMessageSchema],
  queries: [SCRIPT_OUTLINE_REQUESTED, SCRIPT_LINT_REQUESTED]
};

export const SHADER_RELAY_SCHEMAS: AssetRelaySchemas<ScriptLintRequest> = {
  inbound: [lintRequestedSchema],
  outbound: [lintMessageSchema],
  queries: [SCRIPT_LINT_REQUESTED]
};
