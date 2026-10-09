// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import { setImmediate } from "node:timers/promises";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { WebSocket } from "ws";

// Import Internal Dependencies
import {
  WebsocketConnection,
  type WebsocketConnectionSocket
} from "#src/transport/WebsocketConnection.ts";
import { captureLogger } from "../helpers/captureLogger.ts";

class FakeSocket implements WebsocketConnectionSocket {
  readyState: number = WebSocket.OPEN;
  bufferedAmount = 0;
  isPaused = false;
  terminated = false;
  sent: string[] = [];

  send(
    data: string
  ): void {
    this.sent.push(data);
  }

  ping = () => void 0;

  pause(): void {
    this.isPaused = true;
  }

  resume(): void {
    this.isPaused = false;
  }

  terminate(): void {
    this.terminated = true;
  }

  close = () => void 0;
}

function connectionOver(
  socket: FakeSocket,
  onMessage: (json: string) => Promise<void> = () => Promise.resolve()
): WebsocketConnection {
  return new WebsocketConnection({
    id: "client-1",
    socket,
    logger: captureLogger().logger,
    maxBufferedBytes: 1024,
    onMessage
  });
}

describe("WebsocketConnection", () => {
  test("terminates a slow reader whose send queue is past maxBufferedBytes", () => {
    const socket = new FakeSocket();
    const connection = connectionOver(socket);

    socket.bufferedAmount = 1024;
    connection.sendSerialized("\"kept\"");
    socket.bufferedAmount = 1025;
    connection.sendSerialized("\"dropped\"");

    assert.deepEqual(socket.sent, ["\"kept\""]);
    assert.strictEqual(socket.terminated, true);
  });

  test("pauses reading at 64 messages in flight and resumes once 16 remain", async() => {
    const socket = new FakeSocket();
    const handlers: PromiseWithResolvers<void>[] = [];
    const connection = connectionOver(socket, () => {
      const handler = Promise.withResolvers<void>();
      handlers.push(handler);

      return handler.promise;
    });

    for (let index = 0; index < 63; index++) {
      connection.receive("{}");
    }
    assert.strictEqual(socket.isPaused, false);
    connection.receive("{}");
    assert.strictEqual(socket.isPaused, true);

    for (const handler of handlers.splice(0, 47)) {
      handler.resolve();
    }
    await setImmediate();
    assert.strictEqual(socket.isPaused, true);

    handlers.shift()?.resolve();
    await setImmediate();
    assert.strictEqual(socket.isPaused, false);
  });
});
