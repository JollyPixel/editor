// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  AVATAR_MAX_BYTES,
  AccountsClient,
  AccountsRequestError,
  InvalidPasswordError
} from "#src/index.ts";

function offlineClient(): AccountsClient {
  return new AccountsClient({
    url: "http://studio.local/api/accounts/",
    fetch: async() => assert.fail("the client sent a request")
  });
}

describe("AccountsClient", () => {
  test("checks the password length before sending anything", async() => {
    await assert.rejects(
      offlineClient().register("Alice", "short"),
      InvalidPasswordError
    );
  });

  test("checks the avatar size before sending anything", async() => {
    await assert.rejects(
      offlineClient().replaceAvatar(new Blob([new Uint8Array(AVATAR_MAX_BYTES + 1)])),
      (error) => error instanceof AccountsRequestError &&
        error.code === "payload-too-large"
    );
  });
});
