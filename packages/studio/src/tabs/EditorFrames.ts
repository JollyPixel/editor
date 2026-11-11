// Import Third-party Dependencies
import {
  PageAppearance,
  parseFrameMessage,
  readDebugLogger,
  type Appearance,
  type CatalogShare,
  type FrameConsoles,
  type HostLogger,
  type LaunchIdentity,
  type LaunchPorts,
  type ShellCommand
} from "@jolly-pixel/editor.host";
import type { PreferenceOverrides, Preferences } from "@jolly-pixel/preferences";
import type { Notifier } from "@jolly-pixel/ui";
import type { PreferenceScopes } from "@jolly-pixel/server";

// Import Internal Dependencies
import type { EditorTab } from "./EditorTabs.ts";
import { EditorFrame } from "./EditorFrame.ts";
import { FrameNotifications } from "./FrameNotifications.ts";

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
   * Shows the frames' notifications, each named by its frame's title.
   */
  notifications: Notifier;
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
  #notifications: FrameNotifications;
  #logger: HostLogger;
  #frames = new Map<string, EditorFrame>();
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
    this.#notifications = new FrameNotifications(options.notifications);
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
    if (frame === undefined) {
      this.#unsentReveals.set(id, key);
    }
    else {
      frame.reveal(key);
    }
  }

  notifySessionRenewed(): void {
    for (const frame of this.#frames.values()) {
      frame.post({
        type: "jolly-session-renewed"
      });
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
    this.#unsentReveals.delete(id);
    this.#notifications.release(id);
    this.#frames.get(id)?.dispose();
    this.#frames.delete(id);
  }

  dispose(): void {
    this.#listening.abort();
    this.#stopPreferences();
    this.#notifications.dispose();
    for (const frame of this.#frames.values()) {
      frame.dispose();
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

    const frame = new EditorFrame({
      id: tab.id,
      element,
      reads: this.#scopes.readBy(tab.editor),
      origin: this.#launchOrigin
    });
    const reveal = this.#unsentReveals.get(tab.id);
    if (reveal !== undefined) {
      this.#unsentReveals.delete(tab.id);
      frame.reveal(reveal);
    }

    return frame;
  }

  #launch(
    frame: EditorFrame
  ): void {
    frame.closePorts();
    this.#notifications.release(frame.id);
    const catalog = new MessageChannel();
    const ports: LaunchPorts = {
      catalog: catalog.port2
    };
    const stops = [this.#share.serve(catalog.port1)];
    if (this.#consoles !== undefined) {
      const consoleChannel = new MessageChannel();
      ports.console = consoleChannel.port2;
      stops.push(this.#consoles.connect(frame.id, consoleChannel.port1));
    }
    frame.launch({
      type: "jolly-launch",
      target: frame.id,
      appearance: this.#appearance.toJSON(),
      identity: this.#identity(),
      preferences: Object.fromEntries(
        [...this.#preferences].filter(([scope]) => frame.reads.has(scope))
      ),
      ports
    }, stops);
  }

  #command(
    frame: EditorFrame,
    command: ShellCommand
  ): void {
    this.#logger.debug("shell command", {
      from: frame.id,
      ...command
    });
    this.#onShellCommand?.(command, frame.id);
  }

  readonly #onMessage = (
    event: MessageEvent
  ): void => {
    const frame = [...this.#frames.values()].find(
      (candidate) => candidate.owns(event.source)
    );
    if (frame === undefined) {
      return;
    }
    const message = parseFrameMessage(event.data);
    if (message === undefined) {
      return;
    }

    switch (message.type) {
      case "jolly-ready":
        this.#logger.debug("launch posted", {
          target: frame.id,
          origin: this.#launchOrigin
        });
        this.#launch(frame);
        break;
      case "jolly-notification":
      case "jolly-notification-update":
      case "jolly-notification-dismiss":
        this.#notifications.receive(frame.id, frame.element.title, message);
        break;
      case "jolly-update-preferences":
        if (frame.reads.has(message.scope)) {
          this.#command(frame, message);
        }
        break;
      default:
        this.#command(frame, message);
    }
  };

  readonly #sharePreferences = (
    scope: string,
    overrides: PreferenceOverrides
  ): void => {
    for (const frame of this.#frames.values()) {
      if (frame.reads.has(scope)) {
        frame.post({
          type: "jolly-preferences",
          scope,
          overrides
        });
      }
    }
  };

  readonly #shareAppearance = (
    appearance: Appearance
  ): void => {
    for (const frame of this.#frames.values()) {
      frame.post({
        type: "jolly-appearance",
        appearance
      });
    }
  };
}
