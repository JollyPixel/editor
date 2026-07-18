export type ModifierToken = "mod" | "shift" | "alt";

export type NamedKey =
  | "Delete" | "Backspace" | "Enter" | "Escape" | "Tab" | "Space"
  | "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight"
  | "F1" | "F2" | "F3" | "F4" | "F5" | "F6" | "F7" | "F8" | "F9" | "F10" | "F11" | "F12";

export type KeyToken = NamedKey | (string & {});

/**
 * A single key combo, e.g. "mod+z" or "mod+shift+z". "mod" matches either
 * Ctrl or Cmd, so a default binding works the same on every platform. The
 * key segment is matched against the character produced (`KeyboardEvent.key`,
 * case-insensitive) rather than physical key position, so "z" means
 * "whatever key produces the Z character on the user's layout" — the same
 * convention every other app uses for Ctrl+Z/Ctrl+C-style shortcuts, and
 * correct on AZERTY/QWERTZ without the DSL needing to know about layouts.
 * Named, non-printable keys (Delete, ArrowUp, F1, ...) are listed for
 * autocomplete, but any string is accepted.
 */
export type Keybinding =
  | KeyToken
  | `${ModifierToken}+${KeyToken}`
  | `${ModifierToken}+${ModifierToken}+${KeyToken}`
  | `${ModifierToken}+${ModifierToken}+${ModifierToken}+${KeyToken}`;

export type KeybindingAction = "copy" | "paste" | "undo" | "redo" | "delete";

export type Keybindings = Record<KeybindingAction, Keybinding | Keybinding[]>;

export interface ParsedKeybinding {
  mod: boolean;
  shift: boolean;
  alt: boolean;
  key: string;
}

// CONSTANTS
const kKeybindingActions: KeybindingAction[] = ["copy", "paste", "undo", "redo", "delete"];

export const DEFAULT_KEYBINDINGS: Keybindings = {
  copy: "mod+c",
  paste: "mod+v",
  undo: "mod+z",
  redo: ["mod+y", "mod+shift+z"],
  delete: "Delete"
};

export class InvalidKeybindingError extends Error {
  constructor(
    binding: string,
    options?: { cause?: unknown; }
  ) {
    super(`Invalid keybinding: "${binding}"`, options);
    this.name = "InvalidKeybindingError";
  }
}

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

export function parseKeybinding(
  binding: string
): ParsedKeybinding {
  const parts = binding.split("+");
  if (parts.some((part) => part.length === 0)) {
    throw new InvalidKeybindingError(binding);
  }

  const keyToken = parts[parts.length - 1];
  const modifierTokens = parts.slice(0, -1);

  const parsed: ParsedKeybinding = {
    mod: false,
    shift: false,
    alt: false,
    key: keyToken.toLowerCase()
  };

  for (const modifierToken of modifierTokens) {
    switch (modifierToken.toLowerCase()) {
      case "mod":
        parsed.mod = true;
        break;
      case "shift":
        parsed.shift = true;
        break;
      case "alt":
        parsed.alt = true;
        break;
      default:
        throw new InvalidKeybindingError(binding);
    }
  }

  return parsed;
}

function flattenBindings(
  value: Keybinding | Keybinding[]
): Keybinding[] {
  return Array.isArray(value) ? value : [value];
}

function eventMatchesKeybinding(
  event: KeyboardEvent,
  binding: ParsedKeybinding
): boolean {
  const modPressed = event.ctrlKey || event.metaKey;

  return (
    modPressed === binding.mod &&
    event.shiftKey === binding.shift &&
    event.altKey === binding.alt &&
    event.key.toLowerCase() === binding.key
  );
}

/**
 * Merges a partial override onto a base keybinding set (constructor options
 * and `setKeybindings()` both go through this), validating every binding
 * (throws InvalidKeybindingError) and rejecting the result if two different
 * actions now resolve to the same combo (throws KeybindingConflictError).
 */
export function mergeKeybindings(
  base: Keybindings,
  patch: Partial<Keybindings>
): Keybindings {
  const merged: Keybindings = { ...base, ...patch };

  const seenBy = new Map<string, KeybindingAction>();
  for (const action of kKeybindingActions) {
    for (const binding of flattenBindings(merged[action])) {
      const parsed = parseKeybinding(binding);
      const signature = `${parsed.mod}:${parsed.shift}:${parsed.alt}:${parsed.key}`;

      const existingAction = seenBy.get(signature);
      if (existingAction && existingAction !== action) {
        throw new KeybindingConflictError(binding, existingAction, action);
      }
      seenBy.set(signature, action);
    }
  }

  return merged;
}

export function matchKeybindingAction(
  keybindings: Keybindings,
  event: KeyboardEvent
): KeybindingAction | null {
  for (const action of kKeybindingActions) {
    for (const binding of flattenBindings(keybindings[action])) {
      if (eventMatchesKeybinding(event, parseKeybinding(binding))) {
        return action;
      }
    }
  }

  return null;
}
