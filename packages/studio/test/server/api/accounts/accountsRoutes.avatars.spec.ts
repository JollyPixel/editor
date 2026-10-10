// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import {
  AVATAR_MAX_BYTES,
  AccountsRequestError,
  type Account,
  type RegistrationResult
} from "@jolly-pixel/accounts";

// Import Internal Dependencies
import {
  listenStudioApi,
  requestStatus
} from "../../../helpers/studioApi.ts";

// CONSTANTS
const kPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAA" +
  "EklEQVQImWP4z8CAFWEXHbQSACj/P8FTKqelAAAAAElFTkSuQmCC",
  "base64"
);

function activeAccount(
  result: RegistrationResult
): Account {
  assert.ok(result.status === "active");

  return result.account;
}

describe("accountsRoutes avatars", () => {
  test("replaces the avatar of the signed-in account and serves it", async() => {
    await using server = await listenStudioApi();
    const { client } = server.browser();
    await client.register("Alice", "correct horse");

    const account = await client.replaceAvatar(
      new Blob([kPng], { type: "image/png" })
    );
    const response = await fetch(new URL(account.avatar ?? "", server.url));

    assert.match(
      account.avatar ?? "",
      new RegExp(`^/api/accounts/${account.id}/avatar\\?v=[0-9a-f]{16}$`)
    );
    assert.deepEqual(await client.me(), account);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "image/webp");
    assert.equal(response.headers.get("cache-control"), "public, max-age=31536000, immutable");
    assert.equal(response.headers.get("cross-origin-resource-policy"), "same-origin");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.ok((await response.arrayBuffer()).byteLength > 0);
  });

  test("revalidates an avatar requested without its current hash", async() => {
    await using server = await listenStudioApi();
    const { client } = server.browser();
    await client.register("Alice", "correct horse");
    const account = await client.replaceAvatar(new Blob([kPng]));

    const response = await fetch(new URL(`${account.id}/avatar?v=stale`, server.accountsUrl));

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-cache");
  });

  test("answers not-found for an account without an avatar", async() => {
    await using server = await listenStudioApi();
    const account = activeAccount(
      await server.browser().client.register("Alice", "correct horse")
    );

    const response = await fetch(new URL(`${account.id}/avatar`, server.accountsUrl));

    assert.equal(response.status, 404);
    assert.equal((await response.json()).code, "not-found");
  });

  test("refuses an upload without a session", async() => {
    await using server = await listenStudioApi();

    const response = await fetch(new URL("avatar", server.accountsUrl), {
      method: "PUT",
      body: kPng
    });

    assert.equal(response.status, 401);
    assert.equal((await response.json()).code, "unauthenticated");
  });

  test("refuses an upload that is not an image", async() => {
    await using server = await listenStudioApi();
    const { client } = server.browser();
    await client.register("Alice", "correct horse");

    await assert.rejects(
      client.replaceAvatar(new Blob(["not an image"])),
      (error) => error instanceof AccountsRequestError &&
        error.status === 422 &&
        error.code === "invalid-avatar"
    );
  });

  test("refuses an upload over the size limit", async() => {
    await using server = await listenStudioApi();
    const { client, cookies } = server.browser();
    await client.register("Alice", "correct horse");
    const [[name, value]] = cookies;
    const oversized = new Uint8Array(AVATAR_MAX_BYTES + 1);

    const status = await requestStatus(new URL("avatar", server.accountsUrl), {
      method: "PUT",
      headers: {
        cookie: `${name}=${value}`,
        "content-length": String(oversized.byteLength)
      },
      body: oversized
    });

    assert.equal(status, 413);
  });
});
