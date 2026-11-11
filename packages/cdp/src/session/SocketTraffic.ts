// Import Third-party Dependencies
import type { Page } from "@playwright/test";

export class SocketTraffic {
  #received = 0;
  #sent = 0;

  constructor(
    page: Page
  ) {
    page.on("websocket", (socket) => {
      socket.on("framereceived", ({ payload }) => {
        this.#received += byteLength(payload);
      });
      socket.on("framesent", ({ payload }) => {
        this.#sent += byteLength(payload);
      });
    });
  }

  get received(): number {
    return this.#received;
  }

  get sent(): number {
    return this.#sent;
  }
}

function byteLength(
  payload: string | Buffer
): number {
  return typeof payload === "string" ?
    Buffer.byteLength(payload) :
    payload.length;
}
