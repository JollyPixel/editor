// Import Internal Dependencies
import { SourceError } from "./errors/SourceError.ts";

export function compileScript(
  _source: string
): Promise<string> {
  return Promise.reject(
    new SourceError("Scripts are built by a hosted studio only.")
  );
}
