// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import sharp from "sharp";

// Import Internal Dependencies
import {
  activeAccount,
  createAccounts,
  createDatabase
} from "../../helpers/accounts.ts";
import { listenAccounts } from "../../helpers/accountsServer.ts";
import { solidPng } from "../../helpers/avatar/images.ts";
import {
  AVATAR_MAX_BYTES,
  AccountsRequestError
} from "#src/index.ts";
import { AVATAR_SIZE_PX } from "#src/node.ts";

describe("AccountsApi avatars", () => {
  test("replaces the avatar of the signed-in account and serves it", async() => {
    using database = createDatabase();
    await using server = await listenAccounts(createAccounts(database));
    const { client } = server.browser();
    await client.register("Alice", "correct horse");

    const account = await client.replaceAvatar(
      new Blob([await solidPng(300, 200)], { type: "image/png" })
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
    assert.equal(
      (await sharp(await response.bytes()).metadata()).width,
      AVATAR_SIZE_PX
    );
  });

  test("revalidates an avatar requested without its current hash", async() => {
    using database = createDatabase();
    await using server = await listenAccounts(createAccounts(database));
    const { client } = server.browser();
    await client.register("Alice", "correct horse");
    const account = await client.replaceAvatar(new Blob([await solidPng(8, 8)]));

    const response = await fetch(new URL(`${account.id}/avatar?v=stale`, server.url));

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-cache");
  });

  test("answers not-found for an account without an avatar", async() => {
    using database = createDatabase();
    await using server = await listenAccounts(createAccounts(database));
    const account = await activeAccount(
      server.browser().client.register("Alice", "correct horse")
    );

    const response = await fetch(new URL(`${account.id}/avatar`, server.url));

    assert.equal(response.status, 404);
    assert.equal((await response.json()).code, "not-found");
  });

  test("refuses an upload without a session", async() => {
    using database = createDatabase();
    await using server = await listenAccounts(createAccounts(database));

    const response = await fetch(new URL("avatar", server.url), {
      method: "PUT",
      body: await solidPng(8, 8)
    });

    assert.equal(response.status, 401);
    assert.equal((await response.json()).code, "unauthenticated");
  });

  test("refuses an upload that is not an image", async() => {
    using database = createDatabase();
    await using server = await listenAccounts(createAccounts(database));
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
    using database = createDatabase();
    await using server = await listenAccounts(createAccounts(database));
    const { client, fetch: browserFetch } = server.browser();
    await client.register("Alice", "correct horse");
    const oversized = new Uint8Array(AVATAR_MAX_BYTES + 1);

    const response = await browserFetch(new URL("avatar", server.url), {
      method: "PUT",
      body: oversized
    });

    assert.equal(response.status, 413);
    await assert.rejects(
      client.replaceAvatar(new Blob([oversized])),
      (error) => error instanceof AccountsRequestError &&
        error.code === "payload-too-large"
    );
  });
});
