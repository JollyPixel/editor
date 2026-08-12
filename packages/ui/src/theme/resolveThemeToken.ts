/**
 * Resolves a computed theme token from a host, with an optional fallback.
 */
export function resolveThemeToken(
  host: HTMLElement,
  name: string,
  fallback = ""
): string {
  const value = getComputedStyle(host)
    .getPropertyValue(name)
    .trim();

  return value === "" ? fallback : value;
}
