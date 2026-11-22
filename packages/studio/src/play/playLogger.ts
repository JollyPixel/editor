// Import Third-party Dependencies
import { Systems } from "@jolly-pixel/ecs";
import { errorMessage } from "@jolly-pixel/utils";

// CONSTANTS
const kDebugParam = "debug";
const kAllNamespaces = "*";

export interface PlayLoggerOptions {
  search: string;
  warned: (message: string) => void;
  failed: (message: string, cause: unknown) => void;
}

export function playLogger(
  options: PlayLoggerOptions
): Systems.Logger {
  const { search, warned, failed } = options;
  const patterns = new URLSearchParams(search).get(kDebugParam);

  return new Systems.Logger({
    level: patterns === null ? "warn" : "trace",
    namespaces: patterns === null ? [] : debugPatterns(patterns),
    listener: ({ level, message, meta }) => {
      if (level === "warn") {
        warned(reportLine(message, meta));
      }
      else if (level === "error" || level === "fatal") {
        failed(reportLine(message, meta), meta?.error);
      }
    }
  });
}

function debugPatterns(
  value: string
): string[] {
  const patterns = value
    .split(",")
    .map((pattern) => pattern.trim())
    .filter((pattern) => pattern !== "");

  return patterns.length === 0 ? [kAllNamespaces] : patterns;
}

function reportLine(
  message: string,
  meta: Record<string, unknown> | undefined
): string {
  if (meta === undefined) {
    return message;
  }

  const details = Object.entries(meta).map(
    ([key, value]) => `${key}: ${errorMessage(value)}`
  );

  return `${message} (${details.join(", ")})`;
}
