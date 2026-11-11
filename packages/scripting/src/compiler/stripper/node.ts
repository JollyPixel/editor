// Import Node.js Dependencies
import { stripTypeScriptTypes } from "node:module";

// Import Third-party Dependencies
import { errorMessage } from "@jolly-pixel/utils";

// Import Internal Dependencies
import { SourceError } from "../errors/SourceError.ts";

// CONSTANTS
const kSnippet = /^:(\d+)\n(?:.*\n)*?( *)\^/;

export function stripTypes(
  source: string,
  _name: string
): Promise<string> {
  try {
    return Promise.resolve(
      stripTypeScriptTypes(source)
    );
  }
  catch (cause) {
    const match = cause instanceof Error ?
      kSnippet.exec(cause.stack ?? "") :
      null;

    const error = new SourceError(errorMessage(cause), {
      cause,
      position: match === null ?
        null :
        {
          line: Number(match[1]),
          column: match[2].length + 1
        }
    });

    return Promise.reject(error);
  }
}
