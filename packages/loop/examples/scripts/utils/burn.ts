/**
 * Blocks for `ms` to create a real frame hitch. Demo use only.
 */
export function burn(
  ms: number
): void {
  const until = performance.now() + ms;
  while (performance.now() < until) {
    // Busy-wait.
  }
}
