// Import Third-party Dependencies
import { errorMessage } from "@jolly-pixel/utils";

export interface ShaderErrorPosition {
  line: number;
  column: number;
}

export interface ShaderErrorOptions {
  cause?: unknown;
  position?: ShaderErrorPosition | null;
}

// CONSTANTS
const kStackPosition = /^:(\d+):(\d+)/;

export class ShaderError extends Error {
  static thrown(
    cause: unknown,
    sourceUrl: string | null
  ): ShaderError {
    if (cause instanceof ShaderError) {
      return cause;
    }

    return new ShaderError(errorMessage(cause), {
      cause,
      position: stackPosition(cause, sourceUrl)
    });
  }

  readonly position: ShaderErrorPosition | null;

  constructor(
    message: string,
    options: ShaderErrorOptions = {}
  ) {
    super(message, { cause: options.cause });
    this.name = "ShaderError";
    this.position = options.position ?? null;
  }
}

function stackPosition(
  error: unknown,
  sourceUrl: string | null
): ShaderErrorPosition | null {
  if (sourceUrl === null || !(error instanceof Error)) {
    return null;
  }

  const stack = error.stack ?? "";
  const at = stack.indexOf(`${sourceUrl}:`);
  const match = at === -1 ?
    null :
    kStackPosition.exec(stack.slice(at + sourceUrl.length));
  if (match === null) {
    return null;
  }

  return {
    line: Number(match[1]),
    column: Number(match[2])
  };
}
