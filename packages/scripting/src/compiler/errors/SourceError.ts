// Import Third-party Dependencies
import { errorMessage } from "@jolly-pixel/utils";

export interface SourcePosition {
  line: number;
  column: number;
}

export interface SourceErrorOptions {
  cause?: unknown;
  position?: SourcePosition | null;
}

// CONSTANTS
const kStackPosition = /^:(\d+):(\d+)/;

export class SourceError extends Error {
  static thrown(
    cause: unknown,
    sourceUrl: string | null
  ): SourceError {
    if (cause instanceof SourceError) {
      return cause;
    }

    return new SourceError(errorMessage(cause), {
      cause,
      position: stackPosition(cause, sourceUrl)
    });
  }

  readonly position: SourcePosition | null;

  constructor(
    message: string,
    options: SourceErrorOptions = {}
  ) {
    const { cause, position = null } = options;
    const at = position === null ?
      "" :
      ` (${position.line}:${position.column})`;

    super(`${message}${at}`, { cause });
    this.name = "SourceError";
    this.position = position;
  }
}

function stackPosition(
  error: unknown,
  sourceUrl: string | null
): SourcePosition | null {
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
