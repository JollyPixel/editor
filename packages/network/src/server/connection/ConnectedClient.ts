// Import Internal Dependencies
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
    this.#connection.sendSerialized(JSON.stringify(data));
  }

  sendSerialized(
    json: string
  ): void {
    this.#connection.sendSerialized(json);
  }

  close(
    code: number,
    reason: string
  ): void {
    this.#connection.close(code, reason);
  }
}
