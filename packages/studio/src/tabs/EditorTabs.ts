// Import Third-party Dependencies
import {
  isReadyMessage,
  isShellCommand,
  LAUNCH_MESSAGE_TYPE,
  readDebugLogger,
  type HostLogger,
  type ShellCommand
} from "@jolly-pixel/editor.host";
import type { IconName } from "@jolly-pixel/ui";

// CONSTANTS
export const DEFAULT_TAB_CAP = 4;
export const HOME_TAB_ID = "studio:home";
const kTabTag = "jolly-tab";
const kHomeLabel = "Home";
const kHomeIcon: IconName = "home";

export interface EditorTab {
  id: string;
  label: string;
  url: string;
  icon?: IconName;
}

export interface TabStrip extends HTMLElement {
  value: string;
}

export interface EditorTabsOptions {
  strip: TabStrip;
  frames: HTMLElement;
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
   * @default location.origin
   */
  launchOrigin?: string;
  /**
   * Asked before the least recently activated tab is closed to make room.
   * @default always accepts
   */
  confirmEvict?: (tab: EditorTab) => boolean | Promise<boolean>;
  onShellCommand?: (command: ShellCommand, from: EditorTab) => void;
  /**
   * @default readDebugLogger()
   */
  logger?: HostLogger;
}

interface OpenTab {
  tab: EditorTab;
  item: HTMLElement;
  frame: HTMLIFrameElement;
  activatedAt: number;
}

export class EditorTabs {
  readonly cap: number;

  #strip: TabStrip;
  #frames: HTMLElement;
  #home: HTMLElement;
  #homeItem: HTMLElement;
  #launchOrigin: string;
  #confirmEvict: (tab: EditorTab) => boolean | Promise<boolean>;
  #onShellCommand: ((command: ShellCommand, from: EditorTab) => void) | undefined;
  #logger: HostLogger;
  #open = new Map<string, OpenTab>();
  #active: string | null = null;
  #clock = 0;
  #listening = new AbortController();

  constructor(
    options: EditorTabsOptions
  ) {
    this.cap = options.cap ?? DEFAULT_TAB_CAP;
    this.#strip = options.strip;
    this.#frames = options.frames;
    this.#home = options.home;
    this.#launchOrigin = options.launchOrigin ?? location.origin;
    this.#confirmEvict = options.confirmEvict ?? (() => true);
    this.#onShellCommand = options.onShellCommand;
    this.#logger = (options.logger ?? readDebugLogger()).child({
      namespace: "studio.tabs"
    });

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
    window.addEventListener("message", this.#onMessage, { signal });
  }

  get active(): string {
    return this.#active ?? HOME_TAB_ID;
  }

  get size(): number {
    return this.#open.size;
  }

  ids(): string[] {
    return [...this.#strip.children].flatMap((item) => {
      const id = String(Reflect.get(item, "value"));

      return this.#open.has(id) ? [id] : [];
    });
  }

  has(
    id: string
  ): boolean {
    return this.#open.has(id);
  }

  async open(
    tab: EditorTab
  ): Promise<boolean> {
    if (this.#open.has(tab.id)) {
      return this.focus(tab.id);
    }
    if (this.#open.size >= this.cap) {
      const victim = this.#leastRecent();
      if (victim === undefined || !await this.#confirmEvict(victim.tab)) {
        return false;
      }
      this.close(victim.tab.id);
    }

    const item = document.createElement(kTabTag);
    Object.assign(item, {
      value: tab.id,
      label: tab.label,
      icon: tab.icon ?? "",
      closable: true
    });
    const frame = document.createElement("iframe");
    frame.hidden = true;
    frame.title = tab.label;
    frame.src = tab.url;
    this.#strip.append(item);
    this.#frames.append(frame);
    this.#open.set(tab.id, {
      tab,
      item,
      frame,
      activatedAt: 0
    });

    return this.focus(tab.id);
  }

  focus(
    id: string
  ): boolean {
    if (id === HOME_TAB_ID) {
      this.#show(null);

      return true;
    }

    const entry = this.#open.get(id);
    if (entry === undefined) {
      return false;
    }

    entry.activatedAt = ++this.#clock;
    this.#show(entry);

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
    entry.frame.remove();
    if (this.#active === id) {
      const next = this.#mostRecent();
      if (next === undefined) {
        this.#show(null);
      }
      else {
        this.focus(next.tab.id);
      }
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
    const reference = others[Math.max(index, 1)] ?? null;
    this.#strip.insertBefore(entry.item, reference);

    return true;
  }

  relabel(
    id: string,
    label: string
  ): boolean {
    const entry = this.#open.get(id);
    if (entry === undefined) {
      return false;
    }

    entry.tab = {
      ...entry.tab,
      label
    };
    Object.assign(entry.item, { label });
    entry.frame.title = label;

    return true;
  }

  dispose(): void {
    this.#listening.abort();
    for (const id of this.ids()) {
      this.close(id);
    }
    this.#homeItem.remove();
  }

  #show(
    entry: OpenTab | null
  ): void {
    this.#active = entry?.tab.id ?? null;
    this.#strip.value = this.active;
    this.#home.hidden = entry !== null;
    for (const other of this.#open.values()) {
      other.frame.hidden = other !== entry;
    }
  }

  #leastRecent(): OpenTab | undefined {
    let found: OpenTab | undefined;
    for (const entry of this.#open.values()) {
      if (found === undefined || entry.activatedAt < found.activatedAt) {
        found = entry;
      }
    }

    return found;
  }

  #mostRecent(): OpenTab | undefined {
    let found: OpenTab | undefined;
    for (const entry of this.#open.values()) {
      if (found === undefined || entry.activatedAt > found.activatedAt) {
        found = entry;
      }
    }

    return found;
  }

  #entryOf(
    source: MessageEventSource | null
  ): OpenTab | undefined {
    if (source === null) {
      return undefined;
    }
    for (const entry of this.#open.values()) {
      if (entry.frame.contentWindow === source) {
        return entry;
      }
    }

    return undefined;
  }

  readonly #onMessage = (
    event: MessageEvent
  ): void => {
    const entry = this.#entryOf(event.source);
    if (entry === undefined) {
      return;
    }

    if (isReadyMessage(event.data)) {
      this.#logger.debug("launch posted", {
        target: entry.tab.id,
        origin: this.#launchOrigin
      });
      entry.frame.contentWindow?.postMessage(
        {
          type: LAUNCH_MESSAGE_TYPE,
          target: entry.tab.id
        },
        this.#launchOrigin
      );
    }
    else if (isShellCommand(event.data)) {
      this.#logger.debug("shell command", {
        from: entry.tab.id,
        command: event.data.command,
        target: event.data.target
      });
      this.#onShellCommand?.(event.data, entry.tab);
    }
  };
}
