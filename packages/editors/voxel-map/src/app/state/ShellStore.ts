// Import Internal Dependencies
import { EditorStore } from "./EditorStore.ts";

// CONSTANTS
const kSidebarTabs = [
  "general",
  "blocks",
  "paint",
  "layers"
] as const;
const kSidebarTabSet: ReadonlySet<string> = new Set(kSidebarTabs);

export type SidebarTab = typeof kSidebarTabs[number];

export function isSidebarTab(
  value: string
): value is SidebarTab {
  return kSidebarTabSet.has(value);
}

// Tabs the single texture editor is projected into.
export function isTextureTab(
  tab: SidebarTab
): boolean {
  return tab === "blocks" || tab === "paint";
}

export type ShellStoreEvents = {
  tabChange: (
    tab: SidebarTab
  ) => void;
};

export class ShellStore extends EditorStore<ShellStoreEvents> {
  #tab: SidebarTab = "general";

  get tab(): SidebarTab {
    return this.#tab;
  }

  set tab(
    tab: SidebarTab
  ) {
    if (this.#tab === tab) {
      return;
    }

    this.#tab = tab;
    this.emit("tabChange", tab);
  }
}
