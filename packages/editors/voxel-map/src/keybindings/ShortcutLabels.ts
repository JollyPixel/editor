// Import Internal Dependencies
import type { KeyboardLayoutStore } from "../state/KeyboardLayoutStore.ts";
import type {
  MapAction,
  MapKeyBindingSettings
} from "./MapKeyBindings.ts";

export class ShortcutLabels {
  readonly #layout: KeyboardLayoutStore;
  readonly #settings: MapKeyBindingSettings;

  constructor(
    layout: KeyboardLayoutStore,
    settings: MapKeyBindingSettings
  ) {
    this.#layout = layout;
    this.#settings = settings;
  }

  format(
    action: MapAction
  ): string | null {
    const [label = null] = this.#settings.keyBindings.format(action, {
      layout: this.#layout.layout
    });

    return label;
  }

  label(
    text: string,
    ...actions: MapAction[]
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
    const releases = [
      this.#layout.subscribe("change", listener),
      this.#settings.subscribe("change", listener)
    ];

    return () => {
      for (const release of releases) {
        release();
      }
    };
  }
}
