// Import Third-party Dependencies
import type { Infer } from "@jolly-pixel/network";
import * as z from "zod/mini";

// CONSTANTS
const kOffset = z.int().check(z.minimum(0));

export const scriptDiagnosticSchema = z.object({
  start: kOffset,
  length: kOffset,
  severity: z.enum(["error", "warning"]),
  message: z.string(),
  code: z.nullable(z.string())
});

export type ScriptDiagnostic = Infer<typeof scriptDiagnosticSchema>;
export type ScriptDiagnosticSeverity = ScriptDiagnostic["severity"];
