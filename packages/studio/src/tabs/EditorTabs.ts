// Import Third-party Dependencies
import type { EditorState } from "@jolly-pixel/editor.host";
import "@jolly-pixel/ui/elements/tab";
import type {
  IconName,
  TabStatus
} from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { EditorFrames } from "./EditorFrames.ts";

// CONSTANTS
export const DEFAULT_TAB_CAP = 4;
export const HOME_TAB_ID = "studio:home";
const kTabTag = "jolly-tab";
const kFirstEditorIndex = 1;
const kTabStatus: Record<EditorState, TabStatus> = {
  booting: "busy",
  switching: "busy",
  ready: "idle",
  failed: "failed"
};

export interface EditorTabTitle {
  label: string;
  tooltip?: string;
}

export interface EditorTab extends EditorTabTitle {
  id: string;
  editor: string;
  url: string;
  icon?: IconName;
}

export interface ShellPage {
  id: string;
  label: string;
  icon: IconName;
  element: HTMLElement;
}

export interface TabStrip extends HTMLElement {
  value: string;
}

export type TabItem = HTMLElementTagNameMap[typeof kTabTag];

export interface EditorTabsOptions {
  strip: TabStrip;
  frames: EditorFrames;
  /**
   * Shown when no editor tab is active, behind a fixed tab that cannot be
   * closed and does not count toward `cap`.
   */
  home: HTMLElement;
  /**
   * The fixed tab of `home`, with the value `HOME_TAB_ID`. The caller
   * renders it, so it shows before the tabs exist.
   */
  homeTab: TabItem;
  /**
   * Shell content opened on demand behind a closable tab that does not count
   * toward `cap`.
   * @default []
   */
  pages?: readonly ShellPage[];
  /**
   * @default DEFAULT_TAB_CAP
   */
  cap?: number;
  /**
   * Asked before the least recently activated tab is closed to make room.
   * @default always accepts
   */
  confirmEvict?: (
    tab: EditorTab,
    unsaved: boolean
  ) => boolean | Promise<boolean>;
  /**
   * Asked before the strip closes a tab its editor marked unsaved.
   * @default always accepts
   */
  confirmClose?: (tab: EditorTab) => boolean | Promise<boolean>;
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

interface TabItemProperties {
  label: string;
  icon: IconName | "";
  tooltip?: string;
  closable?: boolean;
}

interface OpenTab {
  tab: EditorTab;
  item: TabItem;
}

interface PageEntry {
  element: HTMLElement;
  item: TabItem;
}

export class EditorTabs {
  readonly cap: number;

  #strip: TabStrip;
  #frames: EditorFrames;
  #confirmEvict: NonNullable<EditorTabsOptions["confirmEvict"]>;
  #confirmClose: NonNullable<EditorTabsOptions["confirmClose"]>;
  #onChange: (() => void) | undefined;
  #open = new Map<string, OpenTab>();
  #pages = new Map<string, PageEntry>();
  #active = HOME_TAB_ID;
  #listening = new AbortController();
  #idleWaiters: Array<() => void> = [];

  constructor(
    options: EditorTabsOptions
  ) {
    this.cap = options.cap ?? DEFAULT_TAB_CAP;
    this.#strip = options.strip;
    this.#frames = options.frames;
    this.#confirmEvict = options.confirmEvict ?? (() => true);
    this.#confirmClose = options.confirmClose ?? (() => true);
    this.#onChange = options.onChange;

    const home: PageEntry = {
      element: options.home,
      item: options.homeTab
    };
    this.#pages.set(HOME_TAB_ID, home);
    for (const page of options.pages ?? []) {
      this.#pages.set(page.id, {
        element: page.element,
        item: this.#createItem(page.id, {
          label: page.label,
          icon: page.icon,
          closable: true
        })
      });
    }
    this.#strip.prepend(home.item);
    this.#show(HOME_TAB_ID);

    const { signal } = this.#listening;
    this.#strip.addEventListener("jolly-tab-change", (event) => {
      this.focus(event.detail.value);
    }, { signal });
    this.#strip.addEventListener("jolly-tab-close", (event) => {
      void this.#closeAsked(event.detail.value);
    }, { signal });
    this.#strip.addEventListener("jolly-tab-reorder", (event) => {
      this.move(event.detail.value, event.detail.index);
    }, { signal });
  }

  get active(): string {
    return this.#active;
  }

  get size(): number {
    return this.#open.size;
  }

  get unsaved(): boolean {
    return [...this.#open.values(), ...this.#pages.values()].some(
      (entry) => entry.item.modified
    );
  }

  ids(): string[] {
    return this.list().map((tab) => tab.id);
  }

  untilIdle(): Promise<void> {
    if (!this.#busy) {
      return Promise.resolve();
    }

    const { promise, resolve } = Promise.withResolvers<void>();
    this.#idleWaiters.push(resolve);

    return promise;
  }

  openPages(): string[] {
    return [...this.#pages.keys()].filter(
      (id) => id !== HOME_TAB_ID && this.#findItem(id) !== null
    );
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
        !(await this.#confirmEvict(victim.tab, victim.item.modified))
      ) {
        return false;
      }
      this.close(victim.tab.id);
    }
    if (!this.#open.has(tab.id)) {
      const item = this.#createItem(tab.id, {
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

  openPage(
    id: string
  ): boolean {
    const page = this.#pages.get(id);
    if (page === undefined) {
      return false;
    }

    if (page.item.parentNode !== this.#strip) {
      this.#strip.append(page.item);
    }

    return this.focus(id);
  }

  focus(
    id: string
  ): boolean {
    if (this.#findItem(id) === null) {
      return false;
    }

    const entry = this.#open.get(id);
    if (entry !== undefined) {
      this.#open.delete(id);
      this.#open.set(id, entry);
    }
    this.#show(id);
    this.#onChange?.();

    return true;
  }

  close(
    id: string
  ): boolean {
    const item = this.#findItem(id);
    if (item === null || id === HOME_TAB_ID) {
      return false;
    }

    item.remove();
    if (this.#open.delete(id)) {
      this.#frames.remove(id);
      this.#releaseIdleWaiters();
    }
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
    this.markUnsaved(id, false);
    if (this.#active === id) {
      this.#show(id);
    }
    else {
      this.#setStatus(entry, "idle");
    }

    return true;
  }

  markUnsaved(
    id: string,
    unsaved: boolean
  ): boolean {
    const item = this.#open.get(id)?.item ?? this.#pages.get(id)?.item;
    if (item === undefined) {
      return false;
    }

    item.modified = unsaved;

    return true;
  }

  markState(
    id: string,
    state: EditorState
  ): boolean {
    const entry = this.#open.get(id);
    if (entry === undefined) {
      return false;
    }

    this.#setStatus(entry, kTabStatus[state]);

    return true;
  }

  move(
    id: string,
    index: number
  ): boolean {
    const item = this.#findItem(id);
    if (item === null || id === HOME_TAB_ID) {
      return false;
    }

    const others = [...this.#strip.children].filter(
      (other) => other !== item
    );
    const reference = others[
      Math.max(index, kFirstEditorIndex)
    ] ?? null;
    this.#strip.insertBefore(item, reference);
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
    for (const page of this.#pages.values()) {
      page.item.remove();
    }
    this.#active = HOME_TAB_ID;
    this.#releaseIdleWaiters();
  }

  #setStatus(
    entry: OpenTab,
    status: TabStatus
  ): void {
    entry.item.status = status;
    this.#releaseIdleWaiters();
  }

  get #busy(): boolean {
    return [...this.#open.values()].some(
      (entry) => entry.item.status === "busy"
    );
  }

  #releaseIdleWaiters(): void {
    if (this.#busy) {
      return;
    }

    const waiters = this.#idleWaiters;
    this.#idleWaiters = [];
    for (const resolve of waiters) {
      resolve();
    }
  }

  async #closeAsked(
    id: string
  ): Promise<void> {
    const entry = this.#open.get(id);
    if (entry?.item.modified && !(await this.#confirmClose(entry.tab))) {
      return;
    }

    this.close(id);
  }

  #createItem(
    id: string,
    properties: TabItemProperties
  ): TabItem {
    const item = document.createElement(kTabTag);
    Object.assign(item, {
      value: id,
      ...properties
    });

    return item;
  }

  #findItem(
    id: string
  ): HTMLElement | null {
    const item = this.#open.get(id)?.item ?? this.#pages.get(id)?.item;

    return item?.parentNode === this.#strip ? item : null;
  }

  #show(
    id: string
  ): void {
    this.#active = id;
    this.#strip.value = id;
    for (const [pageId, page] of this.#pages) {
      page.element.hidden = pageId !== id;
    }
    if (this.#frames.show(this.#open.get(id)?.tab ?? null)) {
      this.markState(id, "booting");
    }
  }
}
