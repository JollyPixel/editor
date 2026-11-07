// Import Internal Dependencies
import type { Frame } from "../../protocol/frame/Frame.ts";

export interface ClientConnection {
  readonly id: string;

  sendFrame(
    frame: Frame
  ): void;

  close(
    code: number,
    reason: string
  ): void;
}
