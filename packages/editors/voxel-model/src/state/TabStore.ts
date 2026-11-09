// Import Third-party Dependencies
import { Emitter } from "@openally/emitt";

// CONSTANTS
export const EDITOR_TABS = ["texture", "material", "animate"] as const;

export type EditorTab = typeof EDITOR_TABS[number];

export type TabEvents = {
  change: (tab: EditorTab) => void;
};

export class TabStore extends Emitter<TabEvents> {
  #active: EditorTab = "texture";

  get active(): EditorTab {
    return this.#active;
  }

  get transforming(): boolean {
    return this.#active !== "material";
  }

  activate(
    tab: EditorTab
  ): void {
    if (tab === this.#active) {
      return;
    }
    this.#active = tab;
    this.emit("change", tab);
  }
}
