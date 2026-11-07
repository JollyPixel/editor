// Import Internal Dependencies
import type { Frame } from "../../protocol/frame/Frame.ts";
import type { SendOptions } from "../extension/ClientHandle.ts";

export interface ClientConnection {
  readonly id: string;

  sendFrame(
    frame: Frame,
    options?: SendOptions
  ): void;

  close(
    code: number,
    reason: string
  ): void;
}
