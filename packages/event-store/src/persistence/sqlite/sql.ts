/**
 * Renders one `?` placeholder per value, for an `IN (...)` clause.
 */
export function placeholdersFor(
  values: readonly unknown[]
): string {
  return values.map(() => "?").join(", ");
}

/**
 * Neutralizes the GLOB metacharacters `[`, `]`, `*` and `?` so that a value
 * matches literally.
 */
export function escapeGlob(
  value: string
): string {
  return value.replace(/[[\]*?]/g, (character) => `[${character}]`);
}
