// Import Third-party Dependencies
import {
  appearanceMessage,
  isReadyMessage,
  isShellCommand,
  launchMessage,
  PageAppearance,
  readDebugLogger,
  type Appearance,
  type CatalogShare,
  type HostLogger,
  type ShellCommand
} from "@jolly-pixel/editor.host";

// Import Internal Dependencies
import type { EditorTab } from "./EditorTabs.ts";

export interface EditorFramesOptions {
  container: HTMLElement;
  /**
   * @default location.origin
   */
  launchOrigin?: string;
  /**
   * @default new PageAppearance()
   */
  appearance?: PageAppearance;
  /**
   * Served to each frame through a port sent with its launch.
   */
  share: Pick<CatalogShare, "serve">;
  onShellCommand?: (command: ShellCommand, from: string) => void;
  /**
   * @default readDebugLogger()
   */
  logger?: HostLogger;
}

export class EditorFrames {
  #container: HTMLElement;
  #launchOrigin: string;
  #appearance: PageAppearance;
  #share: Pick<CatalogShare, "serve">;
  #onShellCommand: ((command: ShellCommand, from: string) => void) | undefined;
  #logger: HostLogger;
  #frames = new Map<string, HTMLIFrameElement>();
  #catalogPorts = new Map<string, () => void>();
  #listening = new AbortController();

  constructor(
    options: EditorFramesOptions
  ) {
    this.#container = options.container;
    this.#launchOrigin = options.launchOrigin ?? location.origin;
    this.#appearance = options.appearance ?? new PageAppearance();
    this.#share = options.share;
    this.#onShellCommand = options.onShellCommand;
    this.#logger = (options.logger ?? readDebugLogger()).child({
      namespace: "studio.tabs"
    });

    const { signal } = this.#listening;
    window.addEventListener("message", this.#onMessage, { signal });
    this.#appearance.watch(this.#shareAppearance, signal);
  }

  show(
    tab: EditorTab | null
  ): void {
    if (tab !== null && !this.#frames.has(tab.id)) {
      this.#frames.set(tab.id, this.#createFrame(tab));
    }
    for (const [id, frame] of this.#frames) {
      frame.hidden = id !== tab?.id;
    }
  }

  retitle(
    id: string,
    title: string
  ): void {
    const frame = this.#frames.get(id);
    if (frame !== undefined) {
      frame.title = title;
    }
  }

  remove(
    id: string
  ): void {
    this.#stopCatalog(id);
    this.#frames.get(id)?.remove();
    this.#frames.delete(id);
  }

  dispose(): void {
    this.#listening.abort();
    for (const id of [...this.#catalogPorts.keys()]) {
      this.#stopCatalog(id);
    }
    for (const frame of this.#frames.values()) {
      frame.remove();
    }
    this.#frames.clear();
  }

  #createFrame(
    tab: EditorTab
  ): HTMLIFrameElement {
    const frame = document.createElement("iframe");
    frame.title = tab.label;
    frame.allow = "keyboard-map";
    frame.src = tab.url;
    this.#container.append(frame);

    return frame;
  }

  #frameOf(
    source: MessageEventSource | null
  ): [string, HTMLIFrameElement] | undefined {
    if (source === null) {
      return undefined;
    }

    return [...this.#frames].find(
      ([, frame]) => frame.contentWindow === source
    );
  }

  #post(
    frame: HTMLIFrameElement,
    message: unknown,
    transfer: Transferable[] = []
  ): void {
    frame.contentWindow?.postMessage(message, this.#launchOrigin, transfer);
  }

  #launch(
    id: string,
    frame: HTMLIFrameElement
  ): void {
    this.#stopCatalog(id);
    const channel = new MessageChannel();
    this.#catalogPorts.set(id, this.#share.serve(channel.port1));
    this.#post(
      frame,
      launchMessage(id, this.#appearance.toJSON()),
      [channel.port2]
    );
  }

  #stopCatalog(
    id: string
  ): void {
    this.#catalogPorts.get(id)?.();
    this.#catalogPorts.delete(id);
  }

  readonly #onMessage = (
    event: MessageEvent
  ): void => {
    const sender = this.#frameOf(event.source);
    if (sender === undefined) {
      return;
    }

    const [id, frame] = sender;
    if (isReadyMessage(event.data)) {
      this.#logger.debug("launch posted", {
        target: id,
        origin: this.#launchOrigin
      });
      this.#launch(id, frame);
    }
    else if (isShellCommand(event.data)) {
      this.#logger.debug("shell command", {
        from: id,
        ...event.data
      });
      this.#onShellCommand?.(event.data, id);
    }
  };

  readonly #shareAppearance = (
    appearance: Appearance
  ): void => {
    const message = appearanceMessage(appearance);
    for (const frame of this.#frames.values()) {
      this.#post(frame, message);
    }
  };
}
