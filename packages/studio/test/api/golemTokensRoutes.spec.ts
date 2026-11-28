// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Third-party Dependencies
import { ACCOUNTS_URL_PATH } from "@jolly-pixel/accounts";
import { GOLEM_TOKENS_URL_PATH } from "@jolly-pixel/server";
import { browser } from "@jolly-pixel/server/testing";

// Import Internal Dependencies
import { AgentTokensClient } from "../../src/golem/AgentTokensClient.ts";
import { StudioAgentTokens } from "../../src/golem/StudioAgentTokens.ts";
import { serveBackend } from "../helpers/studioBackend.ts";

// CONSTANTS
const kPassword = "p".repeat(43);
const kPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAIAAABLbSncAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAA" +
  "EklEQVQImWP4z8CAFWEXHbQSACj/P8FTKqelAAAAAElFTkSuQmCC",
  "base64"
);

describe("PUT /api/golem/tokens/:tokenId/avatar", () => {
  test("gives one token its avatar and keeps the list on an unreadable image", async() => {
    await using backend = await serveBackend();
    const page = browser(new URL(`.${ACCOUNTS_URL_PATH}`, backend.url));
    await page.client.register("Alice", kPassword);
    const tokens = new StudioAgentTokens(new AgentTokensClient({
      url: new URL(`.${GOLEM_TOKENS_URL_PATH}`, backend.url),
      fetch: page.fetch
    }));
    const builder = await tokens.create("Builder");
    const helper = await tokens.create("Helper");
    assert.ok(builder !== null && helper !== null);

    await tokens.replaceAvatar(
      builder.token.id,
      new Blob([kPng], { type: "image/png" })
    );
    const [withAvatar, without] = tokens.tokens;
    const served = await page.fetch(new URL(withAvatar.avatar ?? "", backend.url));

    assert.equal(tokens.error, null);
    assert.equal(served.status, 200);
    assert.deepEqual(without, helper.token);

    await tokens.replaceAvatar(helper.token.id, new Blob(["not an image"]));

    assert.equal(tokens.errorCode, "invalid-avatar");
    assert.deepEqual(tokens.tokens, [withAvatar, helper.token]);
  });
});
