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
  type FrameConsoles,
  type HostLogger,
  type LaunchIdentity,
  type LaunchPorts,
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
  /**
   * Read at each launch, so every frame joins as the same peer.
   * @default () => null
   */
  identity?: () => LaunchIdentity | null;
  consoles?: Pick<FrameConsoles, "connect" | "focus">;
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
  #identity: () => LaunchIdentity | null;
  #consoles: Pick<FrameConsoles, "connect" | "focus"> | undefined;
  #onShellCommand: ((command: ShellCommand, from: string) => void) | undefined;
  #logger: HostLogger;
  #frames = new Map<string, HTMLIFrameElement>();
  #launchPorts = new Map<string, () => void>();
  #listening = new AbortController();

  constructor(
    options: EditorFramesOptions
  ) {
    this.#container = options.container;
    this.#launchOrigin = options.launchOrigin ?? location.origin;
    this.#appearance = options.appearance ?? new PageAppearance();
    this.#share = options.share;
    this.#identity = options.identity ?? (() => null);
    this.#consoles = options.consoles;
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
    this.#consoles?.focus(tab?.id ?? null);
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
    this.#stopPorts(id);
    this.#frames.get(id)?.remove();
    this.#frames.delete(id);
  }

  dispose(): void {
    this.#listening.abort();
    for (const id of [...this.#launchPorts.keys()]) {
      this.#stopPorts(id);
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
    frame.contentWindow?.postMessage(
      message,
      this.#launchOrigin,
      transfer
    );
  }

  #launch(
    id: string,
    frame: HTMLIFrameElement
  ): void {
    this.#stopPorts(id);
    const catalog = new MessageChannel();
    const ports: LaunchPorts = {
      catalog: catalog.port2
    };
    const stops = [this.#share.serve(catalog.port1)];
    if (this.#consoles !== undefined) {
      const consoleChannel = new MessageChannel();
      ports.console = consoleChannel.port2;
      stops.push(this.#consoles.connect(id, consoleChannel.port1));
    }
    this.#launchPorts.set(id, () => {
      for (const stop of stops) {
        stop();
      }
    });
    this.#post(
      frame,
      launchMessage({
        target: id,
        appearance: this.#appearance.toJSON(),
        identity: this.#identity(),
        ports
      }),
      Object.values(ports).filter((port) => port !== undefined)
    );
  }

  #stopPorts(
    id: string
  ): void {
    this.#launchPorts.get(id)?.();
    this.#launchPorts.delete(id);
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
