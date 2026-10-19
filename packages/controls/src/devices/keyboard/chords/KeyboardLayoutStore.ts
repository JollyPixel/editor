// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type { EventTargetAdapter } from "../../../adapters/index.ts";
import {
  KeyChord,
  type KeyChordString
} from "./KeyChord.ts";
import {
  loadKeyboardLayout,
  type KeyboardLayout
} from "./layout.ts";

export type KeyboardLayoutStoreEvents = {
  change: (layout: KeyboardLayout | null) => void;
};

export class KeyboardLayoutStore extends Emitter<KeyboardLayoutStoreEvents> {
  #layout: KeyboardLayout | null = null;

  get layout(): KeyboardLayout | null {
    return this.#layout;
  }

  format(
    chord: KeyChordString
  ): string {
    return KeyChord.parse(chord).format({ layout: this.#layout });
  }

  async refresh(): Promise<void> {
    const layout = await loadKeyboardLayout();
    if (sameLayout(layout, this.#layout)) {
      return;
    }

    this.#layout = layout;
    this.emit("change", layout);
  }

  watch(
    target: EventTargetAdapter
  ): () => void {
    const refresh = () => {
      void this.refresh();
    };

    refresh();
    target.addEventListener("focus", refresh);

    return () => target.removeEventListener("focus", refresh);
  }
}

function sameLayout(
  left: KeyboardLayout | null,
  right: KeyboardLayout | null
): boolean {
  if (left === null || right === null) {
    return left === right;
  }
  if (left.size !== right.size) {
    return false;
  }

  for (const [code, printed] of left) {
    if (right.get(code) !== printed) {
      return false;
    }
  }

  return true;
}
