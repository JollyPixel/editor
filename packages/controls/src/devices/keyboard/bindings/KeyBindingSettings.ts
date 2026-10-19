// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type { KeyChordString } from "../chords/KeyChord.ts";
import {
  KeyBindingMap,
  type KeyBindingDefaults,
  type KeyBindingHandlers,
  type KeyBindingTarget
} from "./KeyBindingMap.ts";
import type { KeyBindingOptions } from "./KeyBindings.ts";

export interface KeyBindingSettingsOptions<TAction extends string> {
  defaults: KeyBindingDefaults<TAction>;
  /**
   * Stored overrides, read with `KeyBindingMap.from()`.
   * @default {}
   */
  overrides?: unknown;
  onDropped?: (message: string) => void;
}

export type KeyBindingSettingsEvents<TAction extends string> = {
  change: (keyBindings: KeyBindingMap<TAction>) => void;
};

export class KeyBindingSettings<TAction extends string>
  extends Emitter<KeyBindingSettingsEvents<TAction>> {
  readonly #defaults: KeyBindingDefaults<TAction>;
  readonly #onDropped: ((message: string) => void) | undefined;
  #keyBindings: KeyBindingMap<TAction>;

  constructor(
    options: KeyBindingSettingsOptions<TAction>
  ) {
    super();

    this.#defaults = options.defaults;
    this.#onDropped = options.onDropped;
    this.#keyBindings = this.#read(options.overrides ?? {});
  }

  get keyBindings(): KeyBindingMap<TAction> {
    return this.#keyBindings;
  }

  bind(
    target: KeyBindingTarget,
    handlers: Partial<KeyBindingHandlers<TAction>>,
    options: KeyBindingOptions = {}
  ): () => void {
    let release = this.#keyBindings.bind(target, handlers, options);
    const unsubscribe = this.subscribe("change", (keyBindings) => {
      release();
      release = keyBindings.bind(target, handlers, options);
    });

    return () => {
      unsubscribe();
      release();
    };
  }

  chordsBoundTo(
    action: TAction
  ): KeyChordString[] {
    return this.#keyBindings
      .chordsBoundTo(action)
      .map((chord) => chord.toString());
  }

  assign(
    action: TAction,
    chords: readonly string[]
  ): void {
    this.#commit(this.#keyBindings.rebind(action, chords));
  }

  reset(
    action?: TAction
  ): void {
    this.#commit(this.#keyBindings.restore(action));
  }

  load(
    overrides: unknown
  ): void {
    const keyBindings = this.#read(overrides);
    if (
      JSON.stringify(keyBindings) !== JSON.stringify(this.#keyBindings)
    ) {
      this.#commit(keyBindings);
    }
  }

  #read(
    overrides: unknown
  ): KeyBindingMap<TAction> {
    const { keyBindings, dropped } = KeyBindingMap.from(
      this.#defaults,
      overrides
    );
    for (const message of dropped) {
      this.#onDropped?.(message);
    }

    return keyBindings;
  }

  #commit(
    keyBindings: KeyBindingMap<TAction>
  ): void {
    this.#keyBindings = keyBindings;
    this.emit("change", keyBindings);
  }
}
