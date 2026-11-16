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
  ServerSettings
} from "#src/server/node/ServerSettings.ts";

// CONSTANTS
const kBase = path.resolve("/studio");

describe("ServerSettings", () => {
  test("defaults to a loopback server that trusts no proxy and compresses its sockets", () => {
    const settings = ServerSettings.parse({
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
    const settings = ServerSettings.parse({
      JOLLY_SOCKET_COMPRESSION: "false"
    });

    assert.equal(settings.compression, false);
  });

  test("reads the port, the host and the allowed hosts", () => {
    const settings = ServerSettings.parse({
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
      const settings = ServerSettings.parse({
        JOLLY_TRUST_PROXY: value
      });

      assert.deepEqual(settings.trustProxy, expected);
    });
  }

  test("defaults the project root to the project folder of the base", () => {
    for (const env of [{}, { JOLLY_PROJECT: "  " }]) {
      assert.strictEqual(
        ServerSettings.parse(env).projectRoot(kBase),
        path.join(kBase, DEFAULT_PROJECT_DIR)
      );
    }
  });

  test("resolves JOLLY_PROJECT against the base", () => {
    const absolute = path.resolve("/games/demo");

    assert.strictEqual(
      ServerSettings.parse({ JOLLY_PROJECT: "../game" }).projectRoot(kBase),
      path.resolve(kBase, "../game")
    );
    assert.strictEqual(
      ServerSettings.parse({ JOLLY_PROJECT: absolute }).projectRoot(kBase),
      absolute
    );
  });

  test("hosts the projects of JOLLY_PROJECTS under their slugs, its state beside them", () => {
    const hosting = ServerSettings.parse({
      JOLLY_PROJECTS: "games"
    }).hosting(kBase);

    assert.equal(hosting.state, path.join(kBase, "games", ".jollypixel"));
    assert.deepEqual(hosting.mount.locate("/p/castle/api/"), {
      slug: "castle",
      pathname: "/api/"
    });
    assert.equal(hosting.mount.locate("/api/projects"), null);
  });

  test("mounts the single project of JOLLY_PROJECT at the root", () => {
    const hosting = ServerSettings.parse({
      JOLLY_PROJECT: "castle"
    }).hosting(kBase);

    assert.equal(hosting.state, path.join(kBase, "castle", ".jollypixel"));
    assert.deepEqual(hosting.mount.locate("/api/"), {
      slug: "castle",
      pathname: "/api/"
    });
  });

  test("refuses JOLLY_PROJECTS together with JOLLY_PROJECT", () => {
    assert.throws(
      () => ServerSettings.parse({
        JOLLY_PROJECT: "castle",
        JOLLY_PROJECTS: "games"
      }),
      /not both/
    );
  });

  test("reads the master password", () => {
    assert.equal(ServerSettings.parse({}).masterPassword, undefined);
    assert.equal(
      ServerSettings.parse({
        JOLLY_MASTER_PASSWORD: "open sesame"
      }).masterPassword,
      "open sesame"
    );
  });

  test("rejects a port that is not a TCP port", () => {
    assert.throws(
      () => ServerSettings.parse({ PORT: "70000" }),
      /PORT/
    );
  });
});
