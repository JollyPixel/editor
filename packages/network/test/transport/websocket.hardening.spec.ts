// Import Node.js Dependencies
import { once } from "node:events";
import {
  createServer,
  request,
  type OutgoingHttpHeaders,
  type Server as HttpServer
} from "node:http";
import { connect } from "node:net";
import {
  after,
  before,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { WebSocket as NodeWebSocket } from "ws";

// Import Internal Dependencies
import {
  Client,
  Server,
  connectWebSocket,
  type AuthenticationProvider
} from "#src/index.ts";
import { WebsocketTransport } from "#src/transport/websocket.ts";
import { WEBSOCKET_PROTOCOL } from "#src/transport/constants.ts";
import { RecordingExtension } from "../helpers/server/RecordingExtension.ts";
import { waitFor } from "../helpers/waitFor.ts";
import { captureLogger } from "../helpers/captureLogger.ts";

// CONSTANTS
const kUpgradeHeaders = {
  Connection: "Upgrade",
  Upgrade: "websocket",
  "Sec-WebSocket-Key": "dGhlIHNhbXBsZSBub25jZQ==",
  "Sec-WebSocket-Version": "13",
  "Sec-WebSocket-Protocol": WEBSOCKET_PROTOCOL
};

describe("WebsocketTransport hardening", () => {
  let httpServer: HttpServer;
  let port: number;

  before(async() => {
    httpServer = createServer();
    httpServer.listen(0);
    await once(httpServer, "listening");

    const address = httpServer.address();
    if (address === null || typeof address === "string") {
      throw new Error("expected a network address");
    }
    port = address.port;
  });

  after(() => {
    httpServer.close();
  });

  function mount(
    path: string,
    options: Partial<ConstructorParameters<typeof WebsocketTransport>[0]> = {},
    auth?: AuthenticationProvider
  ): RecordingExtension {
    const server = new Server({
      auth,
      logger: captureLogger().logger
    });
    const extension = new RecordingExtension("test-ns");
    server.register(extension);
    new WebsocketTransport({
      httpServer,
      server,
      path,
      ...options
    });

    return extension;
  }

  function upgradeStatus(
    path: string,
    headers: OutgoingHttpHeaders
  ): Promise<number> {
    const { promise, resolve, reject } = Promise.withResolvers<number>();
    const req = request({
      host: "127.0.0.1",
      port,
      path,
      headers: {
        ...kUpgradeHeaders,
        ...headers
      }
    });
    req.on("upgrade", (_response, socket) => {
      socket.destroy();
      resolve(101);
    });
    req.on("response", (response) => {
      response.resume();
      resolve(response.statusCode ?? 0);
    });
    req.on("error", reject);
    req.end();

    return promise;
  }

  test("survives a client resetting its socket while authentication is pending", async() => {
    const started = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    mount("/ws-reset", {}, {
      async authenticate(request) {
        started.resolve();
        await release.promise;

        return {
          subject: request.clientId,
          role: request.defaultRole
        };
      }
    });

    const serverSideClosed = Promise.withResolvers<void>();
    httpServer.once("connection", (serverSocket) => {
      serverSocket.once("close", () => serverSideClosed.resolve());
    });
    const socket = connect(port, "127.0.0.1");
    socket.on("error", () => void 0);
    await once(socket, "connect");
    socket.write([
      "GET /ws-reset HTTP/1.1",
      `Host: 127.0.0.1:${port}`,
      ...Object.entries(kUpgradeHeaders).map(([name, value]) => `${name}: ${value}`),
      "",
      ""
    ].join("\r\n"));
    await started.promise;
    socket.resetAndDestroy();
    await serverSideClosed.promise;
    release.resolve();

    const client = new Client({
      socket: () => connectWebSocket({ url: `ws://127.0.0.1:${port}/ws-reset` })
    });
    const room = client.room("test-ns");
    room.join();
    await waitFor(() => room.clientId !== null);
    client.destroy();
  });

  test("answers 403 to a cross-origin browser upgrade and never authenticates it", async() => {
    let attempts = 0;
    mount("/ws-origin", {}, {
      authenticate(request) {
        attempts++;

        return {
          subject: request.clientId,
          role: request.defaultRole
        };
      }
    });

    assert.strictEqual(
      await upgradeStatus("/ws-origin", { Origin: "https://attacker.example" }),
      403
    );
    assert.strictEqual(attempts, 0);
    assert.strictEqual(
      await upgradeStatus("/ws-origin", { Origin: `http://127.0.0.1:${port}` }),
      101
    );
    assert.strictEqual(attempts, 1);
  });

  test("answers 403 to an upgrade addressed to a host name it does not serve", async() => {
    mount("/ws-host");
    mount("/ws-host-allowed", { allowedHosts: ["studio.example"] });

    assert.strictEqual(await upgradeStatus("/ws-host", { Host: "attacker.example" }), 403);
    assert.strictEqual(await upgradeStatus("/ws-host-allowed", { Host: "studio.example" }), 101);
  });

  test("closes a socket that sends a message past maxPayload with code 1009", async() => {
    const extension = mount("/ws-payload", { maxPayload: 1024 });
    const socket = new NodeWebSocket(`ws://127.0.0.1:${port}/ws-payload`, WEBSOCKET_PROTOCOL);
    await once(socket, "open");

    socket.send("x".repeat(2048));
    const [code] = await once(socket, "close");

    assert.strictEqual(code, 1009);
    assert.deepEqual(extension.messages, []);
  });

  test("terminates a socket that stops answering pings", async() => {
    mount("/ws-heartbeat", { heartbeatMs: 50 });
    const answering = new NodeWebSocket(`ws://127.0.0.1:${port}/ws-heartbeat`, WEBSOCKET_PROTOCOL);
    const silent = new NodeWebSocket(`ws://127.0.0.1:${port}/ws-heartbeat`, WEBSOCKET_PROTOCOL, {
      autoPong: false
    });
    await Promise.all([once(answering, "open"), once(silent, "open")]);

    await once(silent, "close");

    assert.strictEqual(answering.readyState, NodeWebSocket.OPEN);
    answering.close();
  });
});
