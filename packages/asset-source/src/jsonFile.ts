// Import Internal Dependencies
import type { AssetSource } from "./AssetSource.ts";
import { AssetPathNotFoundError } from "./errors/AssetPathNotFoundError.ts";

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
  catch (error) {
    if (
      error instanceof AssetPathNotFoundError ||
      error instanceof SyntaxError
    ) {
      return null;
    }

    throw error;
  }
}

export function writeJsonFile(
  source: AssetSource,
  path: string,
  value: unknown
): Promise<void> {
  return source.write(
    path,
    new TextEncoder().encode(
      `${JSON.stringify(value, null, 2)}\n`
    )
  );
}
