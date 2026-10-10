// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { prehashPassword, Username } from "@jolly-pixel/accounts";

// Import Internal Dependencies
import { listenStudioApi } from "../../../helpers/studioApi.ts";

async function postLogin(
  url: URL,
  username: string,
  forwardedFor: string
): Promise<Response> {
  return fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": forwardedFor
    },
    body: JSON.stringify({
      username,
      password: await prehashPassword(Username.parse(username), "wrong horse")
    })
  });
}

describe("accountsRoutes throttle", () => {
  test("answers a throttled login with 429 and Retry-After", async() => {
    await using server = await listenStudioApi({
      throttle: {
        attempts: 2
      }
    });
    const { client } = server.browser();
    await client.register("Alice", "correct horse");
    const url = new URL("login", server.accountsUrl);

    for (let attempt = 0; attempt < 2; attempt++) {
      assert.equal((await postLogin(url, "Alice", "10.0.0.1")).status, 401);
    }
    const throttled = await postLogin(url, "Alice", "10.0.0.1");

    assert.equal(throttled.status, 429);
    assert.equal((await throttled.json()).code, "throttled");
    assert.match(throttled.headers.get("retry-after") ?? "", /^[1-9]\d*$/);
  });

  test("keys the address throttle on the socket, not on X-Forwarded-For", async() => {
    await using server = await listenStudioApi({
      throttle: {
        attempts: 1
      }
    });
    const { client } = server.browser();
    await client.register("Alice", "correct horse");
    await server.browser().client.register("Bob", "correct horse");
    const url = new URL("login", server.accountsUrl);

    assert.equal((await postLogin(url, "Alice", "10.0.0.1")).status, 401);
    assert.equal((await postLogin(url, "Bob", "10.0.0.2")).status, 429);
  });

  test("caps requests per address before authenticating them", async() => {
    await using server = await listenStudioApi({}, {
      requestsPerMinute: 2
    });
    const url = new URL("me", server.accountsUrl);

    for (let request = 0; request < 2; request++) {
      assert.equal((await fetch(url)).status, 401);
    }
    const capped = await fetch(url);

    assert.equal(capped.status, 429);
    assert.equal((await capped.json()).code, "throttled");
    assert.match(capped.headers.get("retry-after") ?? "", /^[1-9]\d*$/);
  });
});
