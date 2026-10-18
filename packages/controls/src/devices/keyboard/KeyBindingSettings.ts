// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type { KeyChordString } from "./KeyChord.ts";
import {
  KeyBindingMap,
  type KeyBindingDefaults,
  type KeyBindingHandlers,
  type KeyBindingTarget
} from "./KeyBindingMap.ts";
import type { KeyBindingOptions } from "./KeyBindings.ts";

export interface KeyBindingStorage {
  get(key: string): string | null;
  set(
    key: string,
    value: string
  ): void;
}

export interface KeyBindingSettingsOptions<TAction extends string> {
  defaults: KeyBindingDefaults<TAction>;
  storage: KeyBindingStorage;
  storageKey: string;
  onDropped?: (message: string) => void;
}

export type KeyBindingSettingsEvents<TAction extends string> = {
  change: (keyBindings: KeyBindingMap<TAction>) => void;
};

export interface KeyBindingsReceiver<TAction extends string> {
  keyBindings: KeyBindingMap<TAction>;
}

export class KeyBindingSettings<TAction extends string>
  extends Emitter<KeyBindingSettingsEvents<TAction>> {
  readonly #storage: KeyBindingStorage;
  readonly #storageKey: string;
  #keyBindings: KeyBindingMap<TAction>;

  constructor(
    options: KeyBindingSettingsOptions<TAction>
  ) {
    super();

    const {
      defaults,
      storage,
      storageKey,
      onDropped
    } = options;
    this.#storage = storage;
    this.#storageKey = storageKey;

    const raw = storage.get(storageKey);
    if (raw === null) {
      this.#keyBindings = new KeyBindingMap(defaults);

      return;
    }

    const { keyBindings, dropped } = KeyBindingMap.parse(defaults, raw);
    this.#keyBindings = keyBindings;
    if (dropped.length > 0) {
      for (const message of dropped) {
        onDropped?.(message);
      }
      this.#save();
    }
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

  sync(
    target: KeyBindingsReceiver<TAction>
  ): () => void {
    target.keyBindings = this.#keyBindings;

    return this.subscribe("change", (keyBindings) => {
      target.keyBindings = keyBindings;
    });
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

  #commit(
    keyBindings: KeyBindingMap<TAction>
  ): void {
    this.#keyBindings = keyBindings;
    this.#save();
    this.emit("change", keyBindings);
  }

  #save(): void {
    this.#storage.set(
      this.#storageKey,
      JSON.stringify(this.#keyBindings)
    );
  }
}
