// Import Internal Dependencies
import type { Server } from "../../server/Server.ts";
import type {
  ClientSocket,
  SocketConnectOptions
} from "../ClientSocket.ts";
import { LoopbackSocket } from "./LoopbackSocket.ts";

export interface LoopbackTransportOptions {
  server: Server;
}

export class LoopbackTransport {
  #server: Server;

  constructor(
    options: LoopbackTransportOptions
  ) {
    this.#server = options.server;
  }

  connect(
    options: SocketConnectOptions = {}
  ): ClientSocket {
    return new LoopbackSocket(
      this.#server,
      options.credential
    );
  }
}
