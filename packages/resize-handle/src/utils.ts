export interface SizeFromDeltaOptions {
  /** Target size in pixels when the drag starts. */
  initialSize: number;
  /** Pointer coordinate in pixels when the drag starts. */
  startDrag: number;
  /** Current pointer coordinate in pixels. */
  current: number;
  /** Whether increasing the pointer coordinate increases the size. */
  fromStart: boolean;
  /** Smallest returned size in pixels. */
  min: number;
  /** Largest returned size in pixels. */
  max: number;
}

/**
 * Applies pointer travel to an initial size and clamps the result.
 */
export function sizeFromDelta(
  options: SizeFromDeltaOptions
): number {
  const {
    initialSize,
    startDrag,
    current,
    fromStart,
    min,
    max
  } = options;
  const delta = fromStart ?
    current - startDrag :
    startDrag - current;

  return Math.min(
    Math.max(initialSize + delta, min),
    max
  );
}
