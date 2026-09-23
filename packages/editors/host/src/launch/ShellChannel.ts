// Import Third-party Dependencies
import { AssetId } from "@jolly-pixel/asset";
import * as z from "zod";

// CONSTANTS
export const READY_MESSAGE_TYPE = "jolly-ready";
export const SHELL_MESSAGE_TYPE = "jolly-shell";
const kShellCommandSchema = z.object({
  type: z.literal(SHELL_MESSAGE_TYPE),
  command: z.literal("open-asset"),
  target: z.string()
});
const kReadyMessageSchema = z.object({
  type: z.literal(READY_MESSAGE_TYPE)
});

export interface ShellReadyMessage {
  type: typeof READY_MESSAGE_TYPE;
}

export interface ShellOpenAssetCommand {
  type: typeof SHELL_MESSAGE_TYPE;
  command: "open-asset";
  target: string;
}

export type ShellCommand = ShellOpenAssetCommand;

export interface ShellPort {
  postMessage(
    message: unknown,
    targetOrigin: string
  ): void;
}

export interface ShellChannelOptions {
  port: ShellPort;
  origin: string;
}

export class ShellChannel {
  readonly origin: string;

  #port: ShellPort;

  constructor(
    options: ShellChannelOptions
  ) {
    this.#port = options.port;
    this.origin = options.origin;
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

  #post(
    command: ShellCommand
  ): void {
    this.#port.postMessage(command, this.origin);
  }
}

export function isShellCommand(
  data: unknown
): data is ShellCommand {
  return kShellCommandSchema.safeParse(data).success;
}

export function isReadyMessage(
  data: unknown
): data is ShellReadyMessage {
  return kReadyMessageSchema.safeParse(data).success;
}
