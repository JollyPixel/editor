// CONSTANTS
const kCoarseMultiplier = 10;
const kFineMultiplier = 0.1;

export interface ModifierKeys {
  shiftKey: boolean;
  altKey: boolean;
}

export function modifierMultiplier(
  event: ModifierKeys
): number {
  if (event.shiftKey) {
    return kCoarseMultiplier;
  }

  return event.altKey ? kFineMultiplier : 1;
}
