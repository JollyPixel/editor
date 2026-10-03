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
  readCredential,
  InvalidCredentialError,
  type AuthenticationRequest
} from "#src/index.ts";
import { WebsocketTransport } from "#src/transport/websocket.ts";
import {
  DEFAULT_WEBSOCKET_PATH,
  WEBSOCKET_AUTH_PROTOCOL_PREFIX,
  WEBSOCKET_PROTOCOL
} from "#src/transport/constants.ts";

// CONSTANTS
const kHandshakeRuns = 25;
const kContinuationByte = 0x80;

function request(
  header: string | string[] | undefined
): AuthenticationRequest {
  return {
    clientId: "client-1",
    url: DEFAULT_WEBSOCKET_PATH,
    defaultRole: "default",
    headers: {
      "sec-websocket-protocol": header
    }
  };
}

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

describe("readCredential properties", () => {
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

          assert.strictEqual(readCredential(request(header)), credential);
        }
      )
    );
  });

  test("is null when no credential protocol is offered", () => {
    fc.assert(
      fc.property(
        fc.option(fc.array(kOtherProtocol, { maxLength: 4 }), { nil: undefined }),
        (others) => {
          const header = others?.join(", ");

          assert.strictEqual(readCredential(request(header)), null);
        }
      )
    );
  });

  test("throws InvalidCredentialError for a token that is not base64url UTF-8", () => {
    fc.assert(
      fc.property(
        fc.oneof(kOutOfAlphabet, kTruncatedQuantum, kInvalidUtf8),
        (encoded) => {
          const header = `${WEBSOCKET_PROTOCOL}, ${WEBSOCKET_AUTH_PROTOCOL_PREFIX}${encoded}`;

          assert.throws(
            () => readCredential(request(header)),
            InvalidCredentialError
          );
        }
      )
    );
  });
});

describe("connectWebSocket credential handshake properties", () => {
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
            received.push(readCredential(attempt));

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
});
