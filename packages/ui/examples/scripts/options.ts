// Import Internal Dependencies
import type {
  GalleryExample,
  GalleryOptionValues
} from "./types.ts";

export function readOptions(
  example: GalleryExample,
  params: URLSearchParams
): GalleryOptionValues {
  const values: Record<string, boolean> = {};
  for (const option of example.options ?? []) {
    const raw = params.get(option.key);
    values[option.key] = raw === null ?
      option.initial ?? false :
      raw !== "0";
  }

  return values;
}

export function writeOption(
  params: URLSearchParams,
  key: string,
  value: boolean
): void {
  params.set(key, value ? "1" : "0");
}

export function clearOptions(
  example: GalleryExample,
  params: URLSearchParams
): void {
  for (const option of example.options ?? []) {
    params.delete(option.key);
  }
}
