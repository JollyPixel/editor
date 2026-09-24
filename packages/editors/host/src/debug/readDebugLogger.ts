// Import Third-party Dependencies
import { Systems } from "@jolly-pixel/engine";

// CONSTANTS
export const DEBUG_QUERY_PARAM = "debug";
export const DEBUG_STORAGE_KEY = "jolly-pixel:debug";
const kAllNamespaces = "*";

export type HostLogger = Systems.Logger;

export interface DebugLoggerOptions {
  /**
   * @default location.search
   */
  search?: string;
  /**
   * @default globalThis.localStorage
   */
  storage?: Pick<Storage, "getItem"> | null;
}

export function readDebugLogger(
  options: DebugLoggerOptions = {}
): HostLogger {
  const query = new URLSearchParams(options.search ?? location.search);
  const patterns = query.get(DEBUG_QUERY_PARAM) ??
    readStoredPatterns(options.storage);

  return new Systems.Logger({
    level: "debug",
    namespaces: patterns === null ? [] : parsePatterns(patterns)
  });
}

function readStoredPatterns(
  storage: Pick<Storage, "getItem"> | null | undefined
): string | null {
  try {
    return (storage === undefined ? globalThis.localStorage : storage)
      ?.getItem(DEBUG_STORAGE_KEY) ?? null;
  }
  catch {
    return null;
  }
}

function parsePatterns(
  value: string
): string[] {
  const patterns = value
    .split(",")
    .map((pattern) => pattern.trim())
    .filter((pattern) => pattern !== "");

  return patterns.length === 0 ? [kAllNamespaces] : patterns;
}
