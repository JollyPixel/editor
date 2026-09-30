// Import Node.js Dependencies
import {
  describe,
  test,
  beforeEach,
  afterEach
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  Client,
  UNAUTHORIZED_CLOSE_CODE
} from "#src/index.ts";
import {
  FakeSocket,
  createClient,
  createOpenClient
} from "../helpers/FakeSocket.ts";
import { captureLogger } from "../helpers/captureLogger.ts";

describe("Client — ready", () => {
  test("ready is false until the socket opens, then dispatches a \"ready\" event", () => {
    const { client, socket } = createClient();

    assert.equal(client.ready, false);

    let fired = 0;
    client.on("ready", () => {
      fired++;
    });
    socket.open();

    assert.equal(client.ready, true);
    assert.equal(fired, 1);
  });

  test("queued messages flush before \"ready\" fires", () => {
    const { client, socket } = createClient();
    client.room("pixel-draw").join();

    let sentBeforeReady = -1;
    client.on("ready", () => {
      sentBeforeReady = socket.sent.length;
    });
    socket.open();

    assert.equal(sentBeforeReady, 1);
  });
});

describe("Client — join profile", () => {
  test("includes the connection's profile on every room's join envelope", () => {
    const { client, socket } = createOpenClient({
      profile: { username: "alice" }
    });

    client.room("pixel-draw").join();
    client.room("voxel-map").join();

    const joins = socket.sent.map((raw) => JSON.parse(raw));
    assert.deepEqual(joins, [
      { room: "pixel-draw", kind: "join", profile: { username: "alice" }, presence: {} },
      { room: "voxel-map", kind: "join", profile: { username: "alice" }, presence: {} }
    ]);
  });

  test("defaults to an empty profile when none is provided", () => {
    const { client, socket } = createOpenClient();

    client.room("pixel-draw").join();

    assert.deepEqual(
      JSON.parse(socket.sent[0]),
      { room: "pixel-draw", kind: "join", profile: {}, presence: {} }
    );
  });
});

describe("Client — default url", () => {
  const originalLocation = globalThis.location;
  const originalWebSocket = globalThis.WebSocket;
  const urls: string[] = [];

  class UrlRecordingSocket extends FakeSocket {
    constructor(
      url: string
    ) {
      super();
      urls.push(url);
    }
  }

  beforeEach(() => {
    urls.length = 0;
    // @ts-expect-error - test double, not a full WebSocket implementation
    globalThis.WebSocket = UrlRecordingSocket;
  });

  afterEach(() => {
    globalThis.location = originalLocation;
    globalThis.WebSocket = originalWebSocket;
  });

  test("derives a ws:// url from location when none is provided", () => {
    // @ts-expect-error - partial Location stub, only protocol/host are read
    globalThis.location = { protocol: "http:", host: "localhost:5173" };

    new Client({});

    assert.deepEqual(urls, ["ws://localhost:5173/ws-sync"]);
  });

  test("derives a wss:// url from location when the page is https", () => {
    // @ts-expect-error - partial Location stub, only protocol/host are read
    globalThis.location = { protocol: "https:", host: "example.com" };

    new Client({});

    assert.deepEqual(urls, ["wss://example.com/ws-sync"]);
  });
});

describe("Client — connection lifecycle", () => {
  test("without reconnect, warns once the socket closes unexpectedly, then drops outgoing messages", () => {
    const { logger, warnings } = captureLogger();
    const { client, socket } = createOpenClient({ logger, reconnect: false });

    socket.serverClose({ code: 1006, reason: "gone" });
    client.room("pixel-draw").join();

    assert.equal(client.ready, false);
    assert.deepEqual(socket.sent, []);
    assert.equal(warnings.length, 2);
    assert.match(warnings[0], /WebSocket closed unexpectedly/);
    assert.match(warnings[1], /dropped message on a closed socket/);
  });

  test("destroy closes the socket without warning", () => {
    const { logger, warnings } = captureLogger();
    const { client } = createOpenClient({ logger });

    client.destroy();

    assert.equal(client.ready, false);
    assert.deepEqual(warnings, []);
  });

  test("an unauthorized close emits \"unauthorized\" without warning", () => {
    const { logger, warnings } = captureLogger();
    const { client, socket } = createClient({ logger });
    let unauthorized = 0;
    client.on("unauthorized", () => unauthorized++);

    socket.serverClose({ code: UNAUTHORIZED_CLOSE_CODE, reason: "unauthorized" });

    assert.equal(unauthorized, 1);
    assert.deepEqual(warnings, []);
  });
});
