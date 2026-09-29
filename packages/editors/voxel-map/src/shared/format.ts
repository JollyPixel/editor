// CONSTANTS
const kNumberFormat = new Intl.NumberFormat("en-US");

export function formatCount(
  count: number,
  singular: string,
  plural = `${singular}s`
): string {
  return `${kNumberFormat.format(count)} ${count === 1 ? singular : plural}`;
}
