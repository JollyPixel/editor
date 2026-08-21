// CONSTANTS
export const CATALOG_URL_PATH = "/__jollypixel/catalog";
export const ASSET_URL_PREFIX = "/assets/";

/**
 * Builds the URL serving one record's bytes.
 */
export function assetSourceUrl(
  source: string,
  prefix: string = ASSET_URL_PREFIX
): string {
  const encoded = source
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const separator = prefix.endsWith("/") ? "" : "/";

  return `${prefix}${separator}${encoded}`;
}
