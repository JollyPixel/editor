// Import Third-party Dependencies
import type { PresencePeer } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { EditorStore } from "./EditorStore.ts";

// CONSTANTS
const kSidebarTabs = [
  "general",
  "paint",
  "blocks",
  "layers"
] as const;
const kSidebarTabSet: ReadonlySet<string> = new Set(kSidebarTabs);

export type SidebarTab = typeof kSidebarTabs[number];

export function isSidebarTab(
  value: string
): value is SidebarTab {
  return kSidebarTabSet.has(value);
}

export type ShellStoreEvents = {
  tabChange: (tab: SidebarTab) => void;
  peersChange: (peers: readonly PresencePeer[]) => void;
};

export class ShellStore extends EditorStore<ShellStoreEvents> {
  #tab: SidebarTab = "general";
  #peers: readonly PresencePeer[] = [];

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

  get peers(): readonly PresencePeer[] {
    return this.#peers;
  }

  set peers(
    peers: Iterable<PresencePeer>
  ) {
    this.#peers = [...peers];
    this.emit(
      "peersChange",
      this.#peers
    );
  }
}
