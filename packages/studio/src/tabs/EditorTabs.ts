// Import Third-party Dependencies
import {
  isReadyMessage,
  isShellCommand,
  LAUNCH_MESSAGE_TYPE,
  type ShellCommand
} from "@jolly-pixel/editor.host";

// CONSTANTS
export const DEFAULT_TAB_CAP = 4;
const kTabTag = "jolly-tab";

export interface EditorTab {
  id: string;
  label: string;
  url: string;
}

export interface TabStrip extends HTMLElement {
  value: string;
}

export interface EditorTabsOptions {
  strip: TabStrip;
  frames: HTMLElement;
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
  #launchOrigin: string;
  #confirmEvict: (tab: EditorTab) => boolean | Promise<boolean>;
  #onShellCommand: ((command: ShellCommand, from: EditorTab) => void) | undefined;
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
    this.#launchOrigin = options.launchOrigin ?? location.origin;
    this.#confirmEvict = options.confirmEvict ?? (() => true);
    this.#onShellCommand = options.onShellCommand;

    const { signal } = this.#listening;
    this.#strip.addEventListener("jolly-tab-change", (event) => {
      this.focus(event.detail.value);
    }, { signal });
    this.#strip.addEventListener("jolly-tab-close", (event) => {
      this.close(event.detail.value);
    }, { signal });
    window.addEventListener("message", this.#onMessage, { signal });
  }

  get active(): string | null {
    return this.#active;
  }

  get size(): number {
    return this.#open.size;
  }

  ids(): string[] {
    return [...this.#open.keys()];
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
    const entry = this.#open.get(id);
    if (entry === undefined) {
      return false;
    }

    entry.activatedAt = ++this.#clock;
    this.#active = id;
    this.#strip.value = id;
    for (const other of this.#open.values()) {
      other.frame.hidden = other !== entry;
    }

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
      this.#active = null;
      const next = this.#mostRecent();
      if (next === undefined) {
        this.#strip.value = "";
      }
      else {
        this.focus(next.tab.id);
      }
    }

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
      entry.frame.contentWindow?.postMessage(
        {
          type: LAUNCH_MESSAGE_TYPE,
          target: entry.tab.id
        },
        this.#launchOrigin
      );
    }
    else if (isShellCommand(event.data)) {
      this.#onShellCommand?.(event.data, entry.tab);
    }
  };
}
