// Import Third-party Dependencies
import { AssetId } from "@jolly-pixel/asset";
import type { PreferenceOverrides } from "@jolly-pixel/preferences";
import {
  peerIdentity,
  type NotificationHandle,
  type NotificationInit,
  type Notifier,
  type PeerIdentity
} from "@jolly-pixel/ui";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type { EditorState } from "../mount/EditorState.ts";
import type { Appearance } from "../preferences/appearance/PageAppearance.ts";
import { ShellCatalog } from "./catalog/ShellCatalog.ts";
import type { PlayScope } from "./playShortcut.ts";
import {
  parseShellMessage,
  type FrameMessage,
  type LaunchMessage,
  type ShellMessage
} from "./protocol.ts";

type ShellEvents = {
  appearance: (appearance: Appearance) => void;
  preferences: (scope: string, overrides: PreferenceOverrides) => void;
};

export interface RenewableClient {
  on(
    event: "unauthorized",
    listener: () => void
  ): unknown;
  reconnect(): void;
}

export interface ShellPort {
  postMessage(
    message: unknown,
    targetOrigin: string
  ): void;
}

export interface ShellChannelOptions {
  port: ShellPort;
  origin: string;
  launch: LaunchMessage;
}

export class ShellChannel implements Notifier {
  readonly origin: string;
  readonly catalog: ShellCatalog | null;
  readonly console: MessagePort | null;
  readonly identity: PeerIdentity | null;

  #port: ShellPort;
  #appearance: Appearance | null;
  #preferences: Readonly<Record<string, PreferenceOverrides>>;
  #events = new Emitter<ShellEvents>();
  #refused = new Set<RenewableClient>();
  #unreadReveal: string | null;
  #revealListener: ((key: string) => void) | null = null;
  #notifications = 0;

  constructor(
    options: ShellChannelOptions
  ) {
    const { port, origin, launch } = options;
    const { catalog, console: consolePort } = launch.ports;
    this.#port = port;
    this.origin = origin;
    this.catalog = catalog === undefined ? null : new ShellCatalog(catalog);
    this.console = consolePort ?? null;
    this.identity = launch.identity === null ?
      null :
      peerIdentity(
        launch.identity.username,
        launch.identity.peerId,
        launch.identity.avatar
      );
    this.#appearance = launch.appearance ?? null;
    this.#preferences = launch.preferences;
    this.#unreadReveal = launch.reveal ?? null;
    window.addEventListener("message", (event) => {
      if (event.source === port && event.origin === origin) {
        const message = parseShellMessage(event.data);
        if (message !== undefined) {
          this.#receive(message);
        }
      }
    });
  }

  openAsset(
    id: AssetId | string,
    reveal?: string
  ): void {
    this.#post({
      type: "jolly-open-asset",
      target: AssetId.from(id).value,
      ...reveal === undefined ? {} : { reveal }
    });
  }

  toggleConsole(): void {
    this.#post({
      type: "jolly-toggle-console"
    });
  }

  play(
    scope: PlayScope
  ): void {
    this.#post({
      type: "jolly-play",
      scope
    });
  }

  reportUnsaved(
    unsaved: boolean
  ): void {
    this.#post({
      type: "jolly-unsaved",
      unsaved
    });
  }

  reportState(
    state: EditorState
  ): void {
    this.#post({
      type: "jolly-editor-state",
      state
    });
  }

  updatePreferences(
    scope: string,
    patch: PreferenceOverrides
  ): void {
    this.#post({
      type: "jolly-update-preferences",
      scope,
      patch
    });
  }

  notify(
    init: NotificationInit
  ): NotificationHandle {
    this.#notifications += 1;
    const id = `notification-${this.#notifications}`;
    this.#post({
      type: "jolly-notification",
      id,
      notification: init
    });

    return {
      id,
      update: (patch) => this.#post({
        type: "jolly-notification-update",
        id,
        patch
      }),
      dismiss: () => this.#post({
        type: "jolly-notification-dismiss",
        id
      })
    };
  }

  renewWhenRefused(
    client: RenewableClient
  ): void {
    client.on("unauthorized", () => {
      this.#refused.add(client);
      this.#post({
        type: "jolly-session-refused"
      });
    });
  }

  onAppearance(
    listener: (appearance: Appearance) => void,
    signal: AbortSignal
  ): void {
    if (signal.aborted) {
      return;
    }

    if (this.#appearance !== null) {
      listener(this.#appearance);
    }
    this.#listen("appearance", listener, signal);
  }

  onPreferences(
    listener: (scope: string, overrides: PreferenceOverrides) => void,
    signal: AbortSignal
  ): void {
    if (signal.aborted) {
      return;
    }

    for (const [scope, overrides] of Object.entries(this.#preferences)) {
      listener(scope, overrides);
    }
    this.#listen("preferences", listener, signal);
  }

  onReveal(
    listener: (key: string) => void,
    signal: AbortSignal
  ): void {
    if (signal.aborted) {
      return;
    }

    this.#revealListener = listener;
    signal.addEventListener("abort", () => {
      if (this.#revealListener === listener) {
        this.#revealListener = null;
      }
    }, { once: true });

    const unread = this.#unreadReveal;
    if (unread !== null) {
      this.#unreadReveal = null;
      listener(unread);
    }
  }

  #receive(
    message: ShellMessage
  ): void {
    switch (message.type) {
      case "jolly-appearance":
        this.#appearance = message.appearance;
        this.#events.emit("appearance", message.appearance);
        break;
      case "jolly-preferences":
        this.#preferences = {
          ...this.#preferences,
          [message.scope]: message.overrides
        };
        this.#events.emit("preferences", message.scope, message.overrides);
        break;
      case "jolly-session-renewed":
        this.#renew();
        break;
      case "jolly-reveal":
        this.#reveal(message.key);
        break;
      default: {
        const unhandled: never = message;
        throw new Error(
          `Unhandled shell message: ${JSON.stringify(unhandled)}`
        );
      }
    }
  }

  #renew(): void {
    const refused = [...this.#refused];
    this.#refused.clear();
    for (const client of refused) {
      client.reconnect();
    }
  }

  #reveal(
    key: string
  ): void {
    if (this.#revealListener === null) {
      this.#unreadReveal = key;
    }
    else {
      this.#revealListener(key);
    }
  }

  #listen<E extends keyof ShellEvents>(
    event: E,
    listener: ShellEvents[E],
    signal: AbortSignal
  ): void {
    signal.addEventListener(
      "abort",
      this.#events.subscribe(event, listener),
      { once: true }
    );
  }

  #post(
    message: FrameMessage
  ): void {
    this.#port.postMessage(message, this.origin);
  }
}
