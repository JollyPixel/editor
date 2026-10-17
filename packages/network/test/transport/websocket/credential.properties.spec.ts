// Import Node.js Dependencies
import { once } from "node:events";
import {
  createServer,
  type Server as HttpServer
} from "node:http";
import {
  after,
  before,
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import fc from "fast-check";

// Import Internal Dependencies
import {
  Server,
  connectWebSocket,
  UNAUTHORIZED_CLOSE_CODE
} from "#src/index.ts";
import { WebsocketTransport } from "#src/transport/websocket/WebsocketTransport.ts";
import { parseCredential } from "#src/transport/websocket/credential.ts";
import {
  DEFAULT_WEBSOCKET_PATH,
  WEBSOCKET_AUTH_PROTOCOL_PREFIX,
  WEBSOCKET_PROTOCOL
} from "#src/transport/websocket/constants.ts";

// CONSTANTS
const kHandshakeRuns = 25;
const kContinuationByte = 0x80;

function token(
  credential: string
): string {
  return WEBSOCKET_AUTH_PROTOCOL_PREFIX +
    Buffer.from(credential, "utf8").toString("base64url");
}

const kOtherProtocol = fc.stringMatching(/^[a-z][a-z0-9.-]{0,12}$/);
const kSpacing = fc.constantFrom("", " ", "  ", "\t");

const kOutOfAlphabet = fc.tuple(
  fc.stringMatching(/^[A-Za-z0-9_-]{0,12}$/),
  fc.constantFrom("+", "/", "=", "!", "%", ".", "é"),
  fc.stringMatching(/^[A-Za-z0-9_-]{0,12}$/)
).map(([head, char, tail]) => head + char + tail);
const kTruncatedQuantum = fc.stringMatching(
  /^(?:[A-Za-z0-9_-]{4}){0,4}[A-Za-z0-9_-]$/
);
const kInvalidUtf8 = fc.uint8Array({ maxLength: 12 }).map(
  (bytes) => Buffer.from([kContinuationByte, ...bytes]).toString("base64url")
);

describe("parseCredential properties", () => {
  test("finds the credential among any offered protocols and spacing", () => {
    fc.assert(
      fc.property(
        fc.string({ unit: "grapheme" }),
        fc.array(kOtherProtocol, { maxLength: 4 }),
        fc.nat(),
        kSpacing,
        fc.boolean(),
        (credential, others, index, spacing, asArray) => {
          const offered = [...others];
          offered.splice(index % (offered.length + 1), 0, token(credential));
          const header = asArray ?
            offered.map((value) => `${spacing}${value}${spacing}`) :
            offered.join(`${spacing},${spacing}`);
          const parsed = parseCredential(header);

          assert.ok(parsed.ok);
          assert.strictEqual(parsed.val, credential);
        }
      )
    );
  });

  test("is undefined when no credential protocol is offered", () => {
    fc.assert(
      fc.property(
        fc.option(fc.array(kOtherProtocol, { maxLength: 4 }), { nil: undefined }),
        (others) => {
          const parsed = parseCredential(others?.join(", "));

          assert.ok(parsed.ok);
          assert.strictEqual(parsed.val, undefined);
        }
      )
    );
  });

  test("fails for a token that is not base64url UTF-8", () => {
    fc.assert(
      fc.property(
        fc.oneof(kOutOfAlphabet, kTruncatedQuantum, kInvalidUtf8),
        (encoded) => {
          const header = `${WEBSOCKET_PROTOCOL}, ${WEBSOCKET_AUTH_PROTOCOL_PREFIX}${encoded}`;

          assert.strictEqual(parseCredential(header).ok, false);
        }
      )
    );
  });
});

describe("WebsocketTransport credential handshake", () => {
  let httpServer: HttpServer;
  let url: string;
  const received: (string | null)[] = [];

  before(async() => {
    httpServer = createServer();
    httpServer.listen(0);
    await once(httpServer, "listening");

    const address = httpServer.address();
    if (address === null || typeof address === "string") {
      throw new Error("expected a network address");
    }
    url = `ws://127.0.0.1:${address.port}${DEFAULT_WEBSOCKET_PATH}`;

    new WebsocketTransport({
      httpServer,
      path: DEFAULT_WEBSOCKET_PATH,
      server: new Server({
        auth: {
          authenticate: (attempt) => {
            received.push(attempt.credential ?? null);

            return null;
          }
        }
      })
    });
  });

  after(() => {
    httpServer.close();
  });

  test("the server reads back the credential the client offered", async() => {
    await fc.assert(
      fc.asyncProperty(
        fc.option(fc.string({ unit: "grapheme" }), { nil: undefined }),
        async(credential) => {
          received.length = 0;
          const socket = connectWebSocket({ url, credential });
          const closed = Promise.withResolvers<void>();
          socket.addEventListener("close", () => closed.resolve());
          await closed.promise;

          assert.deepStrictEqual(received, [credential ?? null]);
        }
      ),
      { numRuns: kHandshakeRuns }
    );
  });

  test("a malformed credential is refused before the provider runs", async() => {
    received.length = 0;
    const socket = new WebSocket(url, [
      WEBSOCKET_PROTOCOL,
      `${WEBSOCKET_AUTH_PROTOCOL_PREFIX}!!!!`
    ]);
    const closed = Promise.withResolvers<number>();
    socket.addEventListener("close", (event) => closed.resolve(event.code));

    assert.strictEqual(await closed.promise, UNAUTHORIZED_CLOSE_CODE);
    assert.deepStrictEqual(received, []);
  });
});
