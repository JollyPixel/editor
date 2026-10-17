export function sqlPlaceholders(
  values: readonly unknown[]
): string {
  return values.map(() => "?").join(", ");
}

export function escapeGlob(
  value: string
): string {
  return value.replace(/[[\]*?]/g, (character) => `[${character}]`);
}
