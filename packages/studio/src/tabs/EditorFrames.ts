// Import Third-party Dependencies
import {
  appearanceMessage,
  isReadyMessage,
  isShellCommand,
  launchMessage,
  PageAppearance,
  preferencesMessage,
  readDebugLogger,
  revealMessage,
  sessionRenewedMessage,
  type Appearance,
  type CatalogShare,
  type FrameConsoles,
  type HostLogger,
  type LaunchIdentity,
  type LaunchPorts,
  type ShellCommand
} from "@jolly-pixel/editor.host";
import type { PreferenceOverrides, Preferences } from "@jolly-pixel/preferences";

// Import Internal Dependencies
import type { EditorTab } from "./EditorTabs.ts";
import type { PreferenceScopes } from "../../shared/PreferenceScopes.ts";

interface EditorFrame {
  element: HTMLIFrameElement;
  reads: ReadonlySet<string>;
}

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
  /**
   * Sent with each launch, and every later change pushed to every frame
   * whose editor reads that scope.
   */
  preferences: Preferences;
  /**
   * Which scopes each editor reads, and so may update.
   */
  scopes: Pick<PreferenceScopes, "readBy">;
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
  #preferences: Preferences;
  #scopes: Pick<PreferenceScopes, "readBy">;
  #stopPreferences: () => void;
  #onShellCommand: ((command: ShellCommand, from: string) => void) | undefined;
  #logger: HostLogger;
  #frames = new Map<string, EditorFrame>();
  #launched = new Map<string, () => void>();
  #unsentReveals = new Map<string, string>();
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
    this.#preferences = options.preferences;
    this.#scopes = options.scopes;
    this.#onShellCommand = options.onShellCommand;
    this.#logger = (options.logger ?? readDebugLogger()).child({
      namespace: "studio.tabs"
    });

    const { signal } = this.#listening;
    window.addEventListener("message", this.#onMessage, { signal });
    this.#appearance.watch(this.#shareAppearance, signal);
    this.#stopPreferences = this.#preferences.subscribe(
      this.#sharePreferences
    );
  }

  show(
    tab: EditorTab | null
  ): boolean {
    const created = tab !== null && !this.#frames.has(tab.id);
    if (created) {
      this.#frames.set(tab.id, this.#createFrame(tab));
    }
    for (const [id, { element }] of this.#frames) {
      element.hidden = id !== tab?.id;
    }
    this.#consoles?.focus(tab?.id ?? null);

    return created;
  }

  retitle(
    id: string,
    title: string
  ): void {
    const frame = this.#frames.get(id);
    if (frame !== undefined) {
      frame.element.title = title;
    }
  }

  reveal(
    id: string,
    key: string
  ): void {
    const frame = this.#frames.get(id);
    if (frame !== undefined && this.#launched.has(id)) {
      this.#post(frame.element, revealMessage(key));
    }
    else {
      this.#unsentReveals.set(id, key);
    }
  }

  notifySessionRenewed(): void {
    const message = sessionRenewedMessage();
    for (const { element } of this.#frames.values()) {
      this.#post(element, message);
    }
  }

  sharePreferences(
    scope: string
  ): void {
    this.#sharePreferences(scope, this.#preferences.overrides(scope));
  }

  remove(
    id: string
  ): void {
    this.#stopPorts(id);
    this.#unsentReveals.delete(id);
    this.#frames.get(id)?.element.remove();
    this.#frames.delete(id);
  }

  dispose(): void {
    this.#listening.abort();
    this.#stopPreferences();
    for (const id of [...this.#launched.keys()]) {
      this.#stopPorts(id);
    }
    for (const { element } of this.#frames.values()) {
      element.remove();
    }
    this.#frames.clear();
  }

  #createFrame(
    tab: EditorTab
  ): EditorFrame {
    const element = document.createElement("iframe");
    element.title = tab.label;
    element.allow = "keyboard-map";
    element.src = tab.url;
    this.#container.append(element);

    return {
      element,
      reads: this.#scopes.readBy(tab.editor)
    };
  }

  #accepts(
    frame: EditorFrame,
    command: ShellCommand
  ): boolean {
    return command.command !== "update-preferences" ||
      frame.reads.has(command.scope);
  }

  #findFrame(
    source: MessageEventSource | null
  ): [string, EditorFrame] | undefined {
    if (source === null) {
      return undefined;
    }

    return [...this.#frames].find(
      ([, frame]) => frame.element.contentWindow === source
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
    frame: EditorFrame
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
    this.#launched.set(id, () => {
      for (const stop of stops) {
        stop();
      }
    });
    this.#post(
      frame.element,
      launchMessage({
        target: id,
        appearance: this.#appearance.toJSON(),
        identity: this.#identity(),
        preferences: Object.fromEntries(
          [...this.#preferences].filter(([scope]) => frame.reads.has(scope))
        ),
        ports
      }),
      Object.values(ports).filter((port) => port !== undefined)
    );
    const reveal = this.#unsentReveals.get(id);
    if (reveal !== undefined) {
      this.#unsentReveals.delete(id);
      this.#post(frame.element, revealMessage(reveal));
    }
  }

  #stopPorts(
    id: string
  ): void {
    this.#launched.get(id)?.();
    this.#launched.delete(id);
  }

  readonly #onMessage = (
    event: MessageEvent
  ): void => {
    const sender = this.#findFrame(event.source);
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
      if (this.#accepts(frame, event.data)) {
        this.#onShellCommand?.(event.data, id);
      }
    }
  };

  readonly #sharePreferences = (
    scope: string,
    overrides: PreferenceOverrides
  ): void => {
    const message = preferencesMessage(scope, overrides);
    for (const { element, reads } of this.#frames.values()) {
      if (reads.has(scope)) {
        this.#post(element, message);
      }
    }
  };

  readonly #shareAppearance = (
    appearance: Appearance
  ): void => {
    const message = appearanceMessage(appearance);
    for (const { element } of this.#frames.values()) {
      this.#post(element, message);
    }
  };
}
