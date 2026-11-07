// Import Third-party Dependencies
import type { Page } from "@playwright/test";

export class SocketTraffic {
  #received = 0;

  constructor(
    page: Page
  ) {
    page.on("websocket", (socket) => {
      socket.on("framereceived", ({ payload }) => {
        this.#received += typeof payload === "string" ?
          Buffer.byteLength(payload) :
          payload.length;
      });
    });
  }

  get received(): number {
    return this.#received;
  }
}
