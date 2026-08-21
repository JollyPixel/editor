/**
 * Deterministic byte helpers shared by the source and sync suites.
 */
export function bytes(
  value: string
): Uint8Array {
  return new TextEncoder().encode(value);
}

export function text(
  value: Uint8Array
): string {
  return new TextDecoder().decode(value);
}
