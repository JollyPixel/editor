// Import Internal Dependencies
import { plainObject } from "./is.ts";

export function parseJsonObject(
  text: string | null
): Record<string, unknown> {
  if (text === null) {
    return {};
  }

  try {
    const value: unknown = JSON.parse(text);

    return plainObject(value) ? value : {};
  }
  catch {
    return {};
  }
}
