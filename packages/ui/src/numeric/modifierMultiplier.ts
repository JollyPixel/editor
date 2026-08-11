// CONSTANTS
const kCoarseMultiplier = 10;
const kFineMultiplier = 0.1;

/**
 * Modifier keys shared by scrubbing and keyboard stepping.
 */
export interface ModifierKeys {
  shiftKey: boolean;
  altKey: boolean;
}

/**
 * Shift coarsens and Alt refines; Ctrl remains available for context clicks.
 */
export function multiplierFor(
  event: ModifierKeys
): number {
  if (event.shiftKey) {
    return kCoarseMultiplier;
  }

  return event.altKey ? kFineMultiplier : 1;
}
