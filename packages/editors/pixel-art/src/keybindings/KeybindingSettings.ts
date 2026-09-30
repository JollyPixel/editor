// Import Third-party Dependencies
import {
  DEFAULT_KEYBINDINGS,
  KEYBINDING_ACTIONS,
  Keybindings,
  type Keybinding,
  type KeybindingAction,
  type KeybindingsMap
} from "@jolly-pixel/pixel-draw.renderer";
import type { StorageAdapter } from "@jolly-pixel/ui";
import { Emitter } from "@openally/emitt";
import * as z from "zod";

// CONSTANTS
export const KEYBINDINGS_STORAGE_KEY = "pixel-art:keybindings";
const kStoredBindings = z.record(z.string(), z.unknown());
const kStoredEntry = z.union([
  z.string(),
  z.array(z.string())
]);

export type KeybindingOverrides = Partial<Record<KeybindingAction, Keybinding[]>>;

export interface KeybindingSettingsOptions {
  storage: StorageAdapter;
  /**
   * @default KEYBINDINGS_STORAGE_KEY
   */
  storageKey?: string;
  onDropped?: (message: string) => void;
}

export type KeybindingSettingsEvents = {
  change: (bindings: Readonly<KeybindingsMap>) => void;
};

export class KeybindingSettings extends Emitter<KeybindingSettingsEvents> {
  readonly #storage: StorageAdapter;
  readonly #storageKey: string;
  #overrides: KeybindingOverrides;

  constructor(
    options: KeybindingSettingsOptions
  ) {
    super();

    this.#storage = options.storage;
    this.#storageKey = options.storageKey ?? KEYBINDINGS_STORAGE_KEY;
    const { overrides, dropped } = readStored(
      this.#storage.get(this.#storageKey),
      options.onDropped ?? (() => undefined)
    );
    this.#overrides = overrides;
    if (dropped) {
      this.#save();
    }
  }

  get overrides(): KeybindingOverrides {
    return structuredClone(this.#overrides);
  }

  get bindings(): KeybindingsMap {
    return {
      ...structuredClone(DEFAULT_KEYBINDINGS),
      ...this.overrides
    };
  }

  bindingsOf(
    action: KeybindingAction
  ): Keybinding[] {
    return listOf(this.#overrides[action] ?? DEFAULT_KEYBINDINGS[action]);
  }

  assign(
    action: KeybindingAction,
    bindings: readonly Keybinding[]
  ): void {
    const overrides = {
      ...this.#overrides,
      [action]: [...bindings]
    };
    void new Keybindings(overrides);

    this.#commit(overrides);
  }

  reset(
    action?: KeybindingAction
  ): void {
    const overrides = action === undefined ? {} : { ...this.#overrides };
    if (action !== undefined) {
      delete overrides[action];
    }

    this.#commit(overrides);
  }

  #commit(
    overrides: KeybindingOverrides
  ): void {
    this.#overrides = differenceFromDefaults(overrides);
    this.#save();
    this.emit("change", this.bindings);
  }

  #save(): void {
    this.#storage.set(
      this.#storageKey,
      JSON.stringify(this.#overrides)
    );
  }
}

interface StoredOverrides {
  overrides: KeybindingOverrides;
  dropped: boolean;
}

function readStored(
  raw: string | null,
  onDropped: (message: string) => void
): StoredOverrides {
  if (raw === null) {
    return {
      overrides: {},
      dropped: false
    };
  }

  const stored = kStoredBindings.safeParse(parseJson(raw));
  if (!stored.success) {
    onDropped("Dropped the stored keybindings: not a JSON object");

    return {
      overrides: {},
      dropped: true
    };
  }

  const accepted: KeybindingOverrides = {};
  let dropped = false;
  for (const [name, value] of Object.entries(stored.data)) {
    const problem = acceptEntry(accepted, name, value);
    if (problem !== null) {
      onDropped(`Dropped the stored keybinding "${name}": ${problem}`);
      dropped = true;
    }
  }

  return {
    overrides: differenceFromDefaults(accepted),
    dropped
  };
}

function acceptEntry(
  accepted: KeybindingOverrides,
  name: string,
  value: unknown
): string | null {
  const action = KEYBINDING_ACTIONS.find((known) => known === name);
  if (action === undefined) {
    return "unknown action";
  }

  const entry = kStoredEntry.safeParse(value);
  if (!entry.success) {
    return "not a string or a list of strings";
  }

  const bindings = listOf(entry.data);
  try {
    void new Keybindings({
      ...accepted,
      [action]: bindings
    });
  }
  catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  accepted[action] = bindings;

  return null;
}

function differenceFromDefaults(
  overrides: KeybindingOverrides
): KeybindingOverrides {
  const difference: KeybindingOverrides = {};
  for (const action of KEYBINDING_ACTIONS) {
    const bindings = overrides[action];
    if (
      bindings !== undefined &&
      !sameBindings(bindings, listOf(DEFAULT_KEYBINDINGS[action]))
    ) {
      difference[action] = bindings;
    }
  }

  return difference;
}

function sameBindings(
  left: readonly Keybinding[],
  right: readonly Keybinding[]
): boolean {
  return left.length === right.length &&
    left.every((binding, index) => binding === right[index]);
}

function listOf(
  value: Keybinding | readonly Keybinding[]
): Keybinding[] {
  return typeof value === "string" ? [value] : [...value];
}

function parseJson(
  raw: string
): unknown {
  try {
    return JSON.parse(raw);
  }
  catch {
    return null;
  }
}
