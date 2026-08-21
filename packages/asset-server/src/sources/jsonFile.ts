// Import Internal Dependencies
import type { AssetSource } from "./AssetSource.ts";

/**
 * Reads parseable JSON or returns `null` so callers can rebuild it.
 *
 * Callers remain responsible for validating the parsed shape.
 */
export async function readJsonFile(
  source: AssetSource,
  path: string
): Promise<unknown> {
  try {
    const raw = await source.read(path);

    return JSON.parse(
      new TextDecoder().decode(raw)
    );
  }
  catch {
    return null;
  }
}

/**
 * Writes a JSON document, pretty-printed and newline-terminated so the
 * committed sidecar stays diff-friendly.
 */
export function writeJsonFile(
  source: AssetSource,
  path: string,
  value: unknown
): Promise<void> {
  return source.write(
    path,
    new TextEncoder().encode(`${JSON.stringify(value, null, 2)}\n`)
  );
}
