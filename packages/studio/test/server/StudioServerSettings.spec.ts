// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  DEFAULT_HOST,
  DEFAULT_PORT,
  StudioServerSettings
} from "../../server/StudioServerSettings.ts";

describe("StudioServerSettings", () => {
  test("defaults to a loopback server that trusts no proxy", () => {
    const settings = StudioServerSettings.parse({
      PORT: "",
      JOLLY_TRUST_PROXY: " "
    });

    assert.equal(settings.port, DEFAULT_PORT);
    assert.equal(settings.host, DEFAULT_HOST);
    assert.deepEqual(settings.allowedHosts, []);
    assert.equal(settings.trustProxy, false);
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

  test("rejects a port that is not a TCP port", () => {
    assert.throws(
      () => StudioServerSettings.parse({ PORT: "70000" }),
      /PORT/
    );
  });
});
