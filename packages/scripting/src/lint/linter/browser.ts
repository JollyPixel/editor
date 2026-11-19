// Import Internal Dependencies
import type { ScriptDiagnostic } from "../../diagnostics/ScriptDiagnostic.schema.ts";

export function lintScript(
  _text: string
): Promise<ScriptDiagnostic[] | null> {
  return Promise.resolve(null);
}
