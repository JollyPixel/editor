// Import Internal Dependencies
import type { KeyboardLayoutStore } from "../chords/KeyboardLayoutStore.ts";
import type { KeyBindingSettings } from "./KeyBindingSettings.ts";

export class ShortcutLabels<TAction extends string> {
  readonly #layout: KeyboardLayoutStore;
  readonly #settings: KeyBindingSettings<TAction>;

  constructor(
    layout: KeyboardLayoutStore,
    settings: KeyBindingSettings<TAction>
  ) {
    this.#layout = layout;
    this.#settings = settings;
  }

  format(
    action: TAction
  ): string | null {
    const [label = null] = this.#settings.keyBindings.format(action, {
      layout: this.#layout.layout
    });

    return label;
  }

  label(
    text: string,
    ...actions: TAction[]
  ): string {
    const shortcuts = actions
      .map((action) => this.format(action))
      .filter((shortcut) => shortcut !== null);

    return shortcuts.length === 0 ?
      text :
      `${text} (${shortcuts.join(" / ")})`;
  }

  subscribe(
    listener: () => void
  ): () => void {
    const stopLayout = this.#layout.subscribe("change", listener);
    const stopSettings = this.#settings.subscribe("change", listener);

    return () => {
      stopLayout();
      stopSettings();
    };
  }
}
