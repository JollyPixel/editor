export function assertPowerOfTwoChunkSize(
  value: number,
  origin: string
): void {
  if (!Number.isInteger(value) || value <= 0 || (value & (value - 1)) !== 0) {
    throw new RangeError(
      `${origin}: chunkSize must be a power of two, received ${value}.`
    );
  }
}
