// Import Third-party Dependencies
import type { IconName } from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { EditorFrames } from "./EditorFrames.ts";

// CONSTANTS
export const DEFAULT_TAB_CAP = 4;
export const HOME_TAB_ID = "studio:home";
const kTabTag = "jolly-tab";
const kHomeLabel = "Home";
const kFirstEditorIndex = 1;
const kHomeIcon: IconName = "home";

export interface EditorTabTitle {
  label: string;
  tooltip?: string;
}

export interface EditorTab extends EditorTabTitle {
  id: string;
  url: string;
  icon?: IconName;
}

export interface TabStrip extends HTMLElement {
  value: string;
}

export interface EditorTabsOptions {
  strip: TabStrip;
  frames: EditorFrames;
  /**
   * Shown when no editor tab is active, behind a fixed tab that cannot be
   * closed and does not count toward `cap`.
   */
  home: HTMLElement;
  /**
   * @default DEFAULT_TAB_CAP
   */
  cap?: number;
  /**
   * Asked before the least recently activated tab is closed to make room.
   * @default always accepts
   */
  confirmEvict?: (tab: EditorTab) => boolean | Promise<boolean>;
  onChange?: () => void;
}

export interface EditorTabOpenOptions {
  /**
   * When false, the tab joins the strip without its frame, which loads on
   * first focus.
   * @default true
   */
  focus?: boolean;
}

interface OpenTab {
  tab: EditorTab;
  item: HTMLElement;
}

export class EditorTabs {
  readonly cap: number;

  #strip: TabStrip;
  #frames: EditorFrames;
  #home: HTMLElement;
  #homeItem: HTMLElement;
  #confirmEvict: (tab: EditorTab) => boolean | Promise<boolean>;
  #onChange: (() => void) | undefined;
  #open = new Map<string, OpenTab>();
  #active: string | null = null;
  #listening = new AbortController();

  constructor(
    options: EditorTabsOptions
  ) {
    this.cap = options.cap ?? DEFAULT_TAB_CAP;
    this.#strip = options.strip;
    this.#frames = options.frames;
    this.#home = options.home;
    this.#confirmEvict = options.confirmEvict ?? (() => true);
    this.#onChange = options.onChange;

    this.#homeItem = document.createElement(kTabTag);
    Object.assign(this.#homeItem, {
      value: HOME_TAB_ID,
      label: kHomeLabel,
      icon: kHomeIcon,
      iconOnly: true,
      fixed: true
    });
    this.#strip.prepend(this.#homeItem);
    this.#show(null);

    const { signal } = this.#listening;
    this.#strip.addEventListener("jolly-tab-change", (event) => {
      this.focus(event.detail.value);
    }, { signal });
    this.#strip.addEventListener("jolly-tab-close", (event) => {
      this.close(event.detail.value);
    }, { signal });
    this.#strip.addEventListener("jolly-tab-reorder", (event) => {
      this.move(event.detail.value, event.detail.index);
    }, { signal });
  }

  get active(): string {
    return this.#active ?? HOME_TAB_ID;
  }

  get size(): number {
    return this.#open.size;
  }

  ids(): string[] {
    return this.list().map((tab) => tab.id);
  }

  list(): EditorTab[] {
    const items = [...this.#strip.children];

    return [...this.#open.values()]
      .sort((left, right) => items.indexOf(left.item) - items.indexOf(right.item))
      .map((entry) => entry.tab);
  }

  has(
    id: string
  ): boolean {
    return this.#open.has(id);
  }

  async open(
    tab: EditorTab,
    options: EditorTabOpenOptions = {}
  ): Promise<boolean> {
    const { focus = true } = options;

    while (!this.#open.has(tab.id) && this.#open.size >= this.cap) {
      const [victim] = this.#open.values();
      if (
        victim === undefined ||
        !(await this.#confirmEvict(victim.tab))
      ) {
        return false;
      }
      this.close(victim.tab.id);
    }
    if (!this.#open.has(tab.id)) {
      const item = document.createElement(kTabTag);
      Object.assign(item, {
        value: tab.id,
        label: tab.label,
        tooltip: tab.tooltip ?? "",
        icon: tab.icon ?? "",
        closable: true
      });
      this.#strip.append(item);
      this.#open.set(tab.id, {
        tab,
        item
      });
    }
    if (focus) {
      return this.focus(tab.id);
    }
    this.#onChange?.();

    return true;
  }

  focus(
    id: string
  ): boolean {
    if (id === HOME_TAB_ID) {
      this.#show(null);
      this.#onChange?.();

      return true;
    }

    const entry = this.#open.get(id);
    if (entry === undefined) {
      return false;
    }

    this.#open.delete(id);
    this.#open.set(id, entry);
    this.#show(entry);
    this.#onChange?.();

    return true;
  }

  close(
    id: string
  ): boolean {
    const entry = this.#open.get(id);
    if (entry === undefined) {
      return false;
    }

    this.#open.delete(id);
    entry.item.remove();
    this.#frames.remove(id);
    if (this.#active === id) {
      this.focus(
        [...this.#open.keys()].at(-1) ?? HOME_TAB_ID
      );
    }
    else {
      this.#onChange?.();
    }

    return true;
  }

  reload(
    id: string
  ): boolean {
    const entry = this.#open.get(id);
    if (entry === undefined) {
      return false;
    }

    this.#frames.remove(id);
    if (this.#active === id) {
      this.#show(entry);
    }

    return true;
  }

  move(
    id: string,
    index: number
  ): boolean {
    const entry = this.#open.get(id);
    if (entry === undefined) {
      return false;
    }

    const others = [...this.#strip.children].filter(
      (item) => item !== entry.item
    );
    const reference = others[
      Math.max(index, kFirstEditorIndex)
    ] ?? null;
    this.#strip.insertBefore(entry.item, reference);
    this.#onChange?.();

    return true;
  }

  relabel(
    id: string,
    title: EditorTabTitle
  ): boolean {
    const entry = this.#open.get(id);
    if (entry === undefined) {
      return false;
    }

    const { label, tooltip } = title;
    entry.tab = {
      ...entry.tab,
      label,
      tooltip
    };
    Object.assign(entry.item, {
      label,
      tooltip: tooltip ?? ""
    });
    this.#frames.retitle(id, label);

    return true;
  }

  dispose(): void {
    this.#listening.abort();
    for (const [id, entry] of this.#open) {
      entry.item.remove();
      this.#frames.remove(id);
    }
    this.#open.clear();
    this.#active = null;
    this.#homeItem.remove();
  }

  #show(
    entry: OpenTab | null
  ): void {
    this.#active = entry?.tab.id ?? null;
    this.#strip.value = this.active;
    this.#home.hidden = entry !== null;
    this.#frames.show(entry?.tab ?? null);
  }
}
