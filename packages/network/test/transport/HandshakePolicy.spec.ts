// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { HandshakePolicy } from "#src/transport/HandshakePolicy.ts";

describe("HandshakePolicy — hosts", () => {
  test("accepts IP addresses, localhost and *.localhost by default", () => {
    const policy = new HandshakePolicy();

    for (const host of [
      "127.0.0.1:5173",
      "192.168.1.20",
      "[::1]:5173",
      "localhost:5173",
      "studio.localhost"
    ]) {
      assert.strictEqual(policy.refusalFor({ host }), null, host);
    }
  });

  test("refuses a domain name it was not given, and a missing Host header", () => {
    const policy = new HandshakePolicy();

    assert.strictEqual(policy.refusalFor({ host: "attacker.example:5173" }), "host");
    assert.strictEqual(policy.refusalFor({}), "host");
  });

  test("accepts listed hosts, and the subdomains of a host starting with \".\"", () => {
    const policy = new HandshakePolicy({
      allowedHosts: ["studio.example", ".jolly.example"]
    });

    assert.strictEqual(policy.refusalFor({ host: "STUDIO.example" }), null);
    assert.strictEqual(policy.refusalFor({ host: "jolly.example" }), null);
    assert.strictEqual(policy.refusalFor({ host: "a.jolly.example:443" }), null);
    assert.strictEqual(policy.refusalFor({ host: "other.studio.example" }), "host");
    assert.strictEqual(policy.refusalFor({ host: "notjolly.example" }), "host");
  });

  test("accepts any host when allowedHosts is true", () => {
    const policy = new HandshakePolicy({ allowedHosts: true });

    assert.strictEqual(policy.refusalFor({ host: "attacker.example" }), null);
  });
});

describe("HandshakePolicy — origins", () => {
  test("accepts an upgrade without an Origin header, as non-browser clients send", () => {
    assert.strictEqual(new HandshakePolicy().refusalFor({ host: "localhost:5173" }), null);
  });

  test("accepts the request's own host as origin, whatever the scheme", () => {
    const policy = new HandshakePolicy();

    for (const origin of ["http://localhost:5173", "https://localhost:5173"]) {
      assert.strictEqual(policy.refusalFor({ host: "localhost:5173", origin }), null, origin);
    }
  });

  test("refuses another origin, another port of the same host, and an opaque origin", () => {
    const policy = new HandshakePolicy();

    for (const origin of ["https://attacker.example", "http://localhost:3000", "null"]) {
      assert.strictEqual(policy.refusalFor({ host: "localhost:5173", origin }), "origin", origin);
    }
  });

  test("accepts listed origins, and any origin when allowedOrigins is true", () => {
    const headers = {
      host: "localhost:5173",
      origin: "http://localhost:3000"
    };

    assert.strictEqual(
      new HandshakePolicy({ allowedOrigins: ["http://localhost:3000"] }).refusalFor(headers),
      null
    );
    assert.strictEqual(new HandshakePolicy({ allowedOrigins: true }).refusalFor(headers), null);
  });

  test("checks the host before the origin", () => {
    assert.strictEqual(
      new HandshakePolicy({ allowedOrigins: true }).refusalFor({
        host: "attacker.example",
        origin: "http://attacker.example"
      }),
      "host"
    );
  });
});
