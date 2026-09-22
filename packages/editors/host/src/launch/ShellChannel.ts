// Import Third-party Dependencies
import { AssetId } from "@jolly-pixel/asset";

// CONSTANTS
export const READY_MESSAGE_TYPE = "jolly-ready";
export const SHELL_MESSAGE_TYPE = "jolly-shell";

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
  return (
    typeof data === "object" &&
    data !== null &&
    "type" in data &&
    data.type === SHELL_MESSAGE_TYPE &&
    "command" in data &&
    data.command === "open-asset" &&
    "target" in data &&
    typeof data.target === "string"
  );
}

export function isReadyMessage(
  data: unknown
): data is ShellReadyMessage {
  return (
    typeof data === "object" &&
    data !== null &&
    "type" in data &&
    data.type === READY_MESSAGE_TYPE
  );
}
