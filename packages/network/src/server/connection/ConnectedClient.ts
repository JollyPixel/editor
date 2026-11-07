// Import Internal Dependencies
import {
  encodeFrame,
  type Frame
} from "../../protocol/frame/Frame.ts";
import type { ClientHandle } from "../extension/ClientHandle.ts";
import type { ClientConnection } from "./ClientConnection.ts";

export class ConnectedClient implements ClientHandle {
  readonly id: string;

  readonly #connection: ClientConnection;

  constructor(
    connection: ClientConnection
  ) {
    this.id = connection.id;
    this.#connection = connection;
  }

  send(
    data: unknown
  ): void {
    this.#connection.sendFrame(encodeFrame(data));
  }

  sendFrame(
    frame: Frame
  ): void {
    this.#connection.sendFrame(frame);
  }

  close(
    code: number,
    reason: string
  ): void {
    this.#connection.close(code, reason);
  }
}
