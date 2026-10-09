// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { TrustedProxies } from "#src/http/TrustedProxies.ts";

// CONSTANTS
const kForwarded = {
  "x-forwarded-for": "198.51.100.7, 10.0.0.5"
};

describe("TrustedProxies.clientAddress", () => {
  const cases = [
    {
      hops: 0,
      expected: "192.0.2.1"
    },
    {
      hops: 1,
      expected: "10.0.0.5"
    },
    {
      hops: 2,
      expected: "198.51.100.7"
    },
    {
      hops: 5,
      expected: "198.51.100.7"
    }
  ];

  for (const { hops, expected } of cases) {
    test(`reads ${expected} through ${hops} hops`, () => {
      assert.equal(
        new TrustedProxies(hops).clientAddress(kForwarded, "192.0.2.1"),
        expected
      );
    });
  }

  test("falls back to the peer when no proxy forwarded an address", () => {
    assert.equal(
      new TrustedProxies(1).clientAddress({}, "192.0.2.1"),
      "192.0.2.1"
    );
  });
});

describe("TrustedProxies.isSecure", () => {
  const cases = [
    {
      hops: 1,
      proto: "https, http",
      expected: false
    },
    {
      hops: 2,
      proto: "https, http",
      expected: true
    }
  ];

  for (const { hops, proto, expected } of cases) {
    test(`reads "${proto}" through ${hops} hops as ${expected ? "HTTPS" : "HTTP"}`, () => {
      const headers = {
        "x-forwarded-proto": proto
      };

      assert.equal(
        new TrustedProxies(hops).isSecure(headers, false),
        expected
      );
    });
  }
});

describe("TrustedProxies", () => {
  test("refuses a negative or fractional hop count", () => {
    assert.throws(() => new TrustedProxies(-1), RangeError);
    assert.throws(() => new TrustedProxies(1.5), RangeError);
  });
});
