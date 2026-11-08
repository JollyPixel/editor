// Import Third-party Dependencies
import initSwc, { transformSync } from "@swc/wasm-typescript-esm";
import { is } from "@jolly-pixel/utils";

// Import Internal Dependencies
import { ShaderError } from "../errors/ShaderError.ts";

let ready: Promise<unknown> | null = null;

export async function stripTypes(
  source: string,
  name: string
): Promise<string> {
  ready ??= initSwc();
  await ready;

  try {
    return transformSync(source, {
      mode: "strip-only",
      filename: name
    }).code;
  }
  catch (cause) {
    throw swcError(cause);
  }
}

function swcError(
  cause: unknown
): ShaderError {
  if (
    !is.object(cause) ||
    !("message" in cause) ||
    typeof cause.message !== "string"
  ) {
    return new ShaderError(String(cause), { cause });
  }

  const position = "startLine" in cause &&
    "startColumn" in cause &&
    typeof cause.startLine === "number" &&
    typeof cause.startColumn === "number" ?
    {
      line: cause.startLine,
      column: cause.startColumn + 1
    } :
    null;

  return new ShaderError(cause.message, {
    cause,
    position
  });
}
