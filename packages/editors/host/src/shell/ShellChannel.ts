// Import Third-party Dependencies
import { AssetId } from "@jolly-pixel/asset";
import type { PreferenceOverrides } from "@jolly-pixel/preferences";
import {
  DENSITIES,
  THEME_MODES,
  peerIdentity,
  type PeerIdentity
} from "@jolly-pixel/ui";
import * as z from "zod/mini";

// Import Internal Dependencies
import type { Appearance } from "../preferences/appearance/PageAppearance.ts";
import {
  EDITOR_STATES,
  type EditorState
} from "./EditorState.ts";
import type { ShellCatalog } from "./catalog/ShellCatalog.ts";

// CONSTANTS
export const READY_MESSAGE_TYPE = "jolly-ready";
export const LAUNCH_MESSAGE_TYPE = "jolly-launch";
export const SHELL_MESSAGE_TYPE = "jolly-shell";
export const APPEARANCE_MESSAGE_TYPE = "jolly-appearance";
export const SESSION_RENEWED_MESSAGE_TYPE = "jolly-session-renewed";
export const PREFERENCES_MESSAGE_TYPE = "jolly-preferences";
export const REVEAL_MESSAGE_TYPE = "jolly-reveal";
const kOverridesSchema = z.record(z.string(), z.unknown());
const kLaunchPreferencesSchema = z.record(z.string(), kOverridesSchema);
const kAppearanceSchema = z.object({
  theme: z.enum(THEME_MODES),
  density: z.enum(DENSITIES)
});
const kLaunchPortsSchema = z.object({
  catalog: z.optional(z.instanceof(MessagePort)),
  console: z.optional(z.instanceof(MessagePort))
});
const kLaunchIdentitySchema = z.object({
  username: z.string().check(z.trim(), z.minLength(1)),
  peerId: z.string().check(z.minLength(1)),
  avatar: z.catch(z.optional(z.string()), undefined)
});
const kReadyMessageSchema = z.object({
  type: z.literal(READY_MESSAGE_TYPE)
});
const kLaunchMessageSchema = z.object({
  type: z.literal(LAUNCH_MESSAGE_TYPE),
  target: z.string(),
  appearance: z.catch(z.optional(kAppearanceSchema), undefined),
  identity: z.catch(z.nullable(kLaunchIdentitySchema), null),
  preferences: z.catch(kLaunchPreferencesSchema, {}),
  ports: z.catch(kLaunchPortsSchema, {})
});
const kShellCommandSchema = z.discriminatedUnion("command", [
  z.object({
    type: z.literal(SHELL_MESSAGE_TYPE),
    command: z.literal("open-asset"),
    target: z.string(),
    reveal: z.optional(z.string())
  }),
  z.object({
    type: z.literal(SHELL_MESSAGE_TYPE),
    command: z.literal("toggle-console")
  }),
  z.object({
    type: z.literal(SHELL_MESSAGE_TYPE),
    command: z.literal("session-refused")
  }),
  z.object({
    type: z.literal(SHELL_MESSAGE_TYPE),
    command: z.literal("unsaved"),
    unsaved: z.boolean()
  }),
  z.object({
    type: z.literal(SHELL_MESSAGE_TYPE),
    command: z.literal("editor-state"),
    state: z.enum(EDITOR_STATES)
  }),
  z.object({
    type: z.literal(SHELL_MESSAGE_TYPE),
    command: z.literal("update-preferences"),
    scope: z.string(),
    patch: kOverridesSchema
  })
]);
const kAppearanceMessageSchema = z.object({
  type: z.literal(APPEARANCE_MESSAGE_TYPE),
  appearance: kAppearanceSchema
});
const kSessionRenewedMessageSchema = z.object({
  type: z.literal(SESSION_RENEWED_MESSAGE_TYPE)
});
const kPreferencesMessageSchema = z.object({
  type: z.literal(PREFERENCES_MESSAGE_TYPE),
  scope: z.string(),
  overrides: kOverridesSchema
});
const kRevealMessageSchema = z.object({
  type: z.literal(REVEAL_MESSAGE_TYPE),
  key: z.string()
});

export interface ShellReadyMessage {
  type: typeof READY_MESSAGE_TYPE;
}

export interface LaunchMessage {
  type: typeof LAUNCH_MESSAGE_TYPE;
  target: string;
  appearance?: Appearance;
  identity: LaunchIdentity | null;
  /**
   * Preference overrides by scope name: the editor's scopes and the host's.
   */
  preferences: Readonly<Record<string, PreferenceOverrides>>;
  ports: LaunchPorts;
}

export interface LaunchMessageOptions {
  target: string;
  appearance: Appearance;
  /**
   * @default {}
   */
  ports?: LaunchPorts;
  /**
   * @default null
   */
  identity?: LaunchIdentity | null;
  /**
   * @default {}
   */
  preferences?: Readonly<Record<string, PreferenceOverrides>>;
}

export interface LaunchIdentity {
  username: string;
  peerId: string;
  /**
   * Same-origin path of the peer's uploaded avatar.
   */
  avatar?: string;
}

export interface LaunchPorts {
  catalog?: MessagePort;
  console?: MessagePort;
}

export interface ShellOpenAssetCommand {
  type: typeof SHELL_MESSAGE_TYPE;
  command: "open-asset";
  target: string;
  /**
   * Handed to the opened editor, which shows what it names.
   */
  reveal?: string;
}

export interface ShellToggleConsoleCommand {
  type: typeof SHELL_MESSAGE_TYPE;
  command: "toggle-console";
}

export interface ShellSessionRefusedCommand {
  type: typeof SHELL_MESSAGE_TYPE;
  command: "session-refused";
}

export interface ShellUnsavedCommand {
  type: typeof SHELL_MESSAGE_TYPE;
  command: "unsaved";
  unsaved: boolean;
}

export interface ShellEditorStateCommand {
  type: typeof SHELL_MESSAGE_TYPE;
  command: "editor-state";
  state: EditorState;
}

export interface ShellUpdatePreferencesCommand {
  type: typeof SHELL_MESSAGE_TYPE;
  command: "update-preferences";
  scope: string;
  patch: PreferenceOverrides;
}

export type ShellCommand =
  | ShellOpenAssetCommand
  | ShellToggleConsoleCommand
  | ShellSessionRefusedCommand
  | ShellUnsavedCommand
  | ShellEditorStateCommand
  | ShellUpdatePreferencesCommand;

export interface AppearanceMessage {
  type: typeof APPEARANCE_MESSAGE_TYPE;
  appearance: Appearance;
}

export interface SessionRenewedMessage {
  type: typeof SESSION_RENEWED_MESSAGE_TYPE;
}

export interface PreferencesMessage {
  type: typeof PREFERENCES_MESSAGE_TYPE;
  scope: string;
  overrides: PreferenceOverrides;
}

export interface RevealMessage {
  type: typeof REVEAL_MESSAGE_TYPE;
  key: string;
}

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
  /**
   * @default null
   */
  appearance?: Appearance | null;
  /**
   * @default null
   */
  catalog?: ShellCatalog | null;
  /**
   * @default null
   */
  console?: MessagePort | null;
  /**
   * @default null
   */
  identity?: LaunchIdentity | null;
  /**
   * @default {}
   */
  preferences?: Readonly<Record<string, PreferenceOverrides>>;
}

export class ShellChannel {
  readonly origin: string;
  readonly appearance: Appearance | null;
  readonly catalog: ShellCatalog | null;
  readonly console: MessagePort | null;
  readonly identity: PeerIdentity | null;
  readonly preferences: Readonly<Record<string, PreferenceOverrides>>;

  #port: ShellPort;
  #unreadReveal: string | null = null;
  #revealListener: ((key: string) => void) | null = null;

  constructor(
    options: ShellChannelOptions
  ) {
    this.#port = options.port;
    window.addEventListener("message", (event) => {
      if (this.#isFromShell(event)) {
        const message = kRevealMessageSchema.safeParse(event.data);
        if (message.success) {
          this.#reveal(message.data.key);
        }
      }
    });
    this.origin = options.origin;
    this.appearance = options.appearance ?? null;
    this.catalog = options.catalog ?? null;
    this.console = options.console ?? null;
    this.preferences = options.preferences ?? {};
    this.identity = options.identity ?
      peerIdentity(
        options.identity.username,
        options.identity.peerId,
        options.identity.avatar
      ) :
      null;
  }

  openAsset(
    id: AssetId | string,
    reveal?: string
  ): void {
    this.#post({
      type: SHELL_MESSAGE_TYPE,
      command: "open-asset",
      target: AssetId.from(id).value,
      ...reveal === undefined ? {} : { reveal }
    });
  }

  toggleConsole(): void {
    this.#post({
      type: SHELL_MESSAGE_TYPE,
      command: "toggle-console"
    });
  }

  reportUnsaved(
    unsaved: boolean
  ): void {
    this.#post({
      type: SHELL_MESSAGE_TYPE,
      command: "unsaved",
      unsaved
    });
  }

  reportState(
    state: EditorState
  ): void {
    this.#post({
      type: SHELL_MESSAGE_TYPE,
      command: "editor-state",
      state
    });
  }

  updatePreferences(
    scope: string,
    patch: PreferenceOverrides
  ): void {
    this.#post({
      type: SHELL_MESSAGE_TYPE,
      command: "update-preferences",
      scope,
      patch
    });
  }

  renewWhenRefused(
    client: RenewableClient
  ): void {
    client.on("unauthorized", () => {
      const renewal = new AbortController();
      window.addEventListener("message", (event) => {
        if (
          this.#isFromShell(event) &&
          isSessionRenewedMessage(event.data)
        ) {
          renewal.abort();
          client.reconnect();
        }
      }, { signal: renewal.signal });
      this.#post({
        type: SHELL_MESSAGE_TYPE,
        command: "session-refused"
      });
    });
  }

  onAppearance(
    listener: (appearance: Appearance) => void,
    signal: AbortSignal
  ): void {
    window.addEventListener("message", (event) => {
      if (
        this.#isFromShell(event) &&
        isAppearanceMessage(event.data)
      ) {
        listener(event.data.appearance);
      }
    }, { signal });
  }

  onPreferences(
    listener: (scope: string, overrides: PreferenceOverrides) => void,
    signal: AbortSignal
  ): void {
    window.addEventListener("message", (event) => {
      if (this.#isFromShell(event)) {
        const message = kPreferencesMessageSchema.safeParse(event.data);
        if (message.success) {
          listener(message.data.scope, message.data.overrides);
        }
      }
    }, { signal });
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

  #isFromShell(
    event: MessageEvent
  ): boolean {
    return event.source === this.#port && event.origin === this.origin;
  }

  #post(
    command: ShellCommand
  ): void {
    this.#port.postMessage(command, this.origin);
  }
}

export function launchMessage(
  options: LaunchMessageOptions
): LaunchMessage {
  return {
    type: LAUNCH_MESSAGE_TYPE,
    target: options.target,
    appearance: options.appearance,
    identity: options.identity ?? null,
    preferences: options.preferences ?? {},
    ports: options.ports ?? {}
  };
}

export function revealMessage(
  key: string
): RevealMessage {
  return {
    type: REVEAL_MESSAGE_TYPE,
    key
  };
}

export function appearanceMessage(
  appearance: Appearance
): AppearanceMessage {
  return {
    type: APPEARANCE_MESSAGE_TYPE,
    appearance
  };
}

export function preferencesMessage(
  scope: string,
  overrides: PreferenceOverrides
): PreferencesMessage {
  return {
    type: PREFERENCES_MESSAGE_TYPE,
    scope,
    overrides
  };
}

export function sessionRenewedMessage(): SessionRenewedMessage {
  return {
    type: SESSION_RENEWED_MESSAGE_TYPE
  };
}

export function isReadyMessage(
  data: unknown
): data is ShellReadyMessage {
  return kReadyMessageSchema.safeParse(data).success;
}

export function parseLaunchMessage(
  data: unknown
): LaunchMessage | undefined {
  const parsed = kLaunchMessageSchema.safeParse(data);

  return parsed.success ? parsed.data : undefined;
}

export function isShellCommand(
  data: unknown
): data is ShellCommand {
  return kShellCommandSchema.safeParse(data).success;
}

function isAppearanceMessage(
  data: unknown
): data is AppearanceMessage {
  return kAppearanceMessageSchema.safeParse(data).success;
}

function isSessionRenewedMessage(
  data: unknown
): data is SessionRenewedMessage {
  return kSessionRenewedMessageSchema.safeParse(data).success;
}
