export type ModifierToken = "mod" | "shift" | "alt";

export type NamedKey =
  | "Delete"
  | "Backspace"
  | "Enter"
  | "Escape"
  | "Tab"
  | "Space"
  | "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight"
  | "F1" | "F2" | "F3" | "F4" | "F5" | "F6" | "F7" | "F8" | "F9" | "F10" | "F11" | "F12";

export type KeyToken = NamedKey | (string & {});

/**
 * Describes a keyboard shortcut.
 */
export type Keybinding =
  | KeyToken
  | `${ModifierToken}+${KeyToken}`
  | `${ModifierToken}+${ModifierToken}+${KeyToken}`
  | `${ModifierToken}+${ModifierToken}+${ModifierToken}+${KeyToken}`;

export type KeybindingAction =
  | "copy"
  | "paste"
  | "undo"
  | "redo"
  | "delete"
  | "rotate"
  | "flipHorizontal"
  | "flipVertical";

export type KeybindingsMap = Record<KeybindingAction, Keybinding | Keybinding[]>;

export interface ParsedKeybinding {
  mod: boolean;
  shift: boolean;
  alt: boolean;
  key: string;
}

// CONSTANTS
const kKeybindingActions: KeybindingAction[] = [
  "copy",
  "paste",
  "undo",
  "redo",
  "delete",
  "rotate",
  "flipHorizontal",
  "flipVertical"
];

export const DEFAULT_KEYBINDINGS: KeybindingsMap = {
  copy: "mod+c",
  paste: "mod+v",
  undo: "mod+z",
  redo: ["mod+y", "mod+shift+z"],
  delete: "Delete",
  rotate: "r",
  flipHorizontal: "h",
  flipVertical: "v"
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

function mergeAndValidate(
  base: KeybindingsMap,
  patch: Partial<KeybindingsMap>
): KeybindingsMap {
  const merged: KeybindingsMap = { ...base, ...patch };

  const seenBy = new Map<string, KeybindingAction>();
  for (const action of kKeybindingActions) {
    for (const binding of flattenBindings(merged[action])) {
      const parsed = parseKeybinding(binding);
      const signature = `${parsed.mod}:${parsed.shift}:${parsed.alt}:${parsed.key}`;

      const existingAction = seenBy.get(signature);
      if (existingAction && existingAction !== action) {
        throw new KeybindingConflictError(
          binding,
          existingAction,
          action
        );
      }
      seenBy.set(signature, action);
    }
  }

  return merged;
}

/**
 * Stores validated keybindings and matches keyboard events against them.
 */
export class Keybindings {
  #bindings: KeybindingsMap;

  constructor(
    patch: Partial<KeybindingsMap> = {}
  ) {
    this.#bindings = mergeAndValidate(
      DEFAULT_KEYBINDINGS,
      patch
    );
  }

  get bindings(): Readonly<KeybindingsMap> {
    return { ...this.#bindings };
  }

  /**
   * Merges patch onto the current bindings. Validates the merged result
   * first, so a conflicting or malformed patch leaves the previous
   * bindings untouched.
   */
  patch(
    patch: Partial<KeybindingsMap>
  ): void {
    this.#bindings = mergeAndValidate(
      this.#bindings,
      patch
    );
  }

  match(
    event: KeyboardEvent
  ): KeybindingAction | null {
    for (const action of kKeybindingActions) {
      for (const binding of flattenBindings(this.#bindings[action])) {
        const isMatching = eventMatchesKeybinding(
          event,
          parseKeybinding(binding)
        );

        if (isMatching) {
          return action;
        }
      }
    }

    return null;
  }
}
