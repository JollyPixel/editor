// Import Internal Dependencies
import type { KeybindingAction } from "../Keybindings.ts";

export class KeybindingConflictError extends Error {
  constructor(
    binding: string,
    actionA: KeybindingAction,
    actionB: KeybindingAction
  ) {
    super(`Keybinding "${binding}" is already assigned to "${actionA}" (conflicts with "${actionB}")`);

    this.name = "KeybindingConflictError";
  }
}
