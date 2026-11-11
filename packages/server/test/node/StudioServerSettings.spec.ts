// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

// Import Internal Dependencies
import {
  DEFAULT_HOST,
  DEFAULT_PORT,
  DEFAULT_PROJECT_DIR,
  StudioServerSettings
} from "#src/node/StudioServerSettings.ts";

// CONSTANTS
const kBase = path.resolve("/studio");

describe("StudioServerSettings", () => {
  test("defaults to a loopback server that trusts no proxy and compresses its sockets", () => {
    const settings = StudioServerSettings.parse({
      PORT: "",
      JOLLY_TRUST_PROXY: " "
    });

    assert.equal(settings.port, DEFAULT_PORT);
    assert.equal(settings.host, DEFAULT_HOST);
    assert.deepEqual(settings.allowedHosts, []);
    assert.equal(settings.trustProxy, false);
    assert.equal(settings.compression, true);
  });

  test("turns socket compression off with JOLLY_SOCKET_COMPRESSION=false", () => {
    const settings = StudioServerSettings.parse({
      JOLLY_SOCKET_COMPRESSION: "false"
    });

    assert.equal(settings.compression, false);
  });

  test("reads the port, the host and the allowed hosts", () => {
    const settings = StudioServerSettings.parse({
      PORT: "8080",
      HOST: "0.0.0.0",
      JOLLY_ALLOWED_HOSTS: "studio.example.com, ,play.example.com"
    });

    assert.equal(settings.port, 8080);
    assert.equal(settings.host, "0.0.0.0");
    assert.deepEqual(
      settings.allowedHosts,
      ["studio.example.com", "play.example.com"]
    );
  });

  for (const [value, expected] of [
    ["true", true],
    ["false", false],
    ["loopback", ["loopback"]],
    ["127.0.0.1, 10.0.0.0/8", ["127.0.0.1", "10.0.0.0/8"]]
  ] as const) {
    test(`reads JOLLY_TRUST_PROXY="${value}"`, () => {
      const settings = StudioServerSettings.parse({
        JOLLY_TRUST_PROXY: value
      });

      assert.deepEqual(settings.trustProxy, expected);
    });
  }

  test("defaults the project root to the project folder of the base", () => {
    for (const env of [{}, { JOLLY_PROJECT: "  " }]) {
      assert.strictEqual(
        StudioServerSettings.parse(env).projectRoot(kBase),
        path.join(kBase, DEFAULT_PROJECT_DIR)
      );
    }
  });

  test("resolves JOLLY_PROJECT against the base", () => {
    const absolute = path.resolve("/games/demo");

    assert.strictEqual(
      StudioServerSettings.parse({ JOLLY_PROJECT: "../game" }).projectRoot(kBase),
      path.resolve(kBase, "../game")
    );
    assert.strictEqual(
      StudioServerSettings.parse({ JOLLY_PROJECT: absolute }).projectRoot(kBase),
      absolute
    );
  });

  test("reads the master password", () => {
    assert.equal(StudioServerSettings.parse({}).masterPassword, undefined);
    assert.equal(
      StudioServerSettings.parse({
        JOLLY_MASTER_PASSWORD: "open sesame"
      }).masterPassword,
      "open sesame"
    );
  });

  test("rejects a port that is not a TCP port", () => {
    assert.throws(
      () => StudioServerSettings.parse({ PORT: "70000" }),
      /PORT/
    );
  });
});
