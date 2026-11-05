// CONSTANTS
const kMebibyte = 1024 * 1024;
export const LARGE_FILE_BYTES = 10 * kMebibyte;

export function formatMegabytes(
  bytes: number
): string {
  return `${Number((bytes / kMebibyte).toFixed(1))} MB`;
}
