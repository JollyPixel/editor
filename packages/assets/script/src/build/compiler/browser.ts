// Import Internal Dependencies
import { ScriptBuildError } from "../errors/ScriptBuildError.ts";

export function compileScript(
  _source: string
): Promise<string> {
  return Promise.reject(
    new ScriptBuildError("Scripts are built by a hosted studio only.")
  );
}
