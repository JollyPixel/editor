export function burn(
  ms: number
): void {
  const until = performance.now() + ms;
  let now = performance.now();
  while (now < until) {
    now = performance.now();
  }
}
