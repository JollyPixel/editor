// Import Third-party Dependencies
import { AssetId } from "@jolly-pixel/asset";
import {
  DENSITIES,
  THEME_MODES
} from "@jolly-pixel/ui";
import * as z from "zod";

// Import Internal Dependencies
import type { Appearance } from "../appearance/PageAppearance.ts";

// CONSTANTS
export const READY_MESSAGE_TYPE = "jolly-ready";
export const LAUNCH_MESSAGE_TYPE = "jolly-launch";
export const SHELL_MESSAGE_TYPE = "jolly-shell";
export const APPEARANCE_MESSAGE_TYPE = "jolly-appearance";
const kAppearanceSchema = z.object({
  theme: z.enum(THEME_MODES),
  density: z.enum(DENSITIES)
});
const kReadyMessageSchema = z.object({
  type: z.literal(READY_MESSAGE_TYPE)
});
const kLaunchMessageSchema = z.object({
  type: z.literal(LAUNCH_MESSAGE_TYPE),
  target: z.string(),
  appearance: kAppearanceSchema.optional().catch(undefined)
});
const kShellCommandSchema = z.discriminatedUnion("command", [
  z.object({
    type: z.literal(SHELL_MESSAGE_TYPE),
    command: z.literal("open-asset"),
    target: z.string()
  }),
  z.object({
    type: z.literal(SHELL_MESSAGE_TYPE),
    command: z.literal("toggle-console")
  })
]);
const kAppearanceMessageSchema = z.object({
  type: z.literal(APPEARANCE_MESSAGE_TYPE),
  appearance: kAppearanceSchema
});

export interface ShellReadyMessage {
  type: typeof READY_MESSAGE_TYPE;
}

export interface LaunchMessage {
  type: typeof LAUNCH_MESSAGE_TYPE;
  target: string;
  appearance?: Appearance;
}

export interface ShellOpenAssetCommand {
  type: typeof SHELL_MESSAGE_TYPE;
  command: "open-asset";
  target: string;
}

export interface ShellToggleConsoleCommand {
  type: typeof SHELL_MESSAGE_TYPE;
  command: "toggle-console";
}

export type ShellCommand =
  | ShellOpenAssetCommand
  | ShellToggleConsoleCommand;

export interface AppearanceMessage {
  type: typeof APPEARANCE_MESSAGE_TYPE;
  appearance: Appearance;
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
}

export class ShellChannel {
  readonly origin: string;
  readonly appearance: Appearance | null;

  #port: ShellPort;

  constructor(
    options: ShellChannelOptions
  ) {
    this.#port = options.port;
    this.origin = options.origin;
    this.appearance = options.appearance ?? null;
  }

  openAsset(
    id: AssetId | string
  ): void {
    this.#post({
      type: SHELL_MESSAGE_TYPE,
      command: "open-asset",
      target: AssetId.from(id).value
    });
  }

  toggleConsole(): void {
    this.#post({
      type: SHELL_MESSAGE_TYPE,
      command: "toggle-console"
    });
  }

  onAppearance(
    listener: (appearance: Appearance) => void,
    signal: AbortSignal
  ): void {
    window.addEventListener("message", (event) => {
      if (
        event.source === this.#port &&
        event.origin === this.origin &&
        isAppearanceMessage(event.data)
      ) {
        listener(event.data.appearance);
      }
    }, { signal });
  }

  #post(
    command: ShellCommand
  ): void {
    this.#port.postMessage(command, this.origin);
  }
}

export function launchMessage(
  target: string,
  appearance: Appearance
): LaunchMessage {
  return {
    type: LAUNCH_MESSAGE_TYPE,
    target,
    appearance
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
