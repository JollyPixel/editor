// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import type {
  Browser,
  ServedBackend
} from "#src/testing.ts";
import { AVATAR_PNG } from "../../helpers/avatarPng.ts";
import { serveBackend } from "../../helpers/serverBackend.ts";
import {
  GOLEM_TOKENS_URL_PATH,
  agentTokenReplySchema,
  agentTokensReplySchema,
  createdAgentTokenReplySchema,
  type AgentTokensReply
} from "#src/golem/api.ts";

// CONSTANTS
const kPassword = "correct horse";

function tokensUrl(
  server: ServedBackend,
  path = ""
): URL {
  return new URL(GOLEM_TOKENS_URL_PATH + path, server.url);
}

function createToken(
  server: ServedBackend,
  browser: Browser,
  body: unknown
): Promise<Response> {
  return browser.fetch(tokensUrl(server), {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });
}

async function listed(
  server: ServedBackend,
  browser: Browser
): Promise<AgentTokensReply["tokens"]> {
  const response = await browser.fetch(tokensUrl(server));
  assert.equal(response.status, 200);

  return agentTokensReplySchema.parse(await response.json()).tokens;
}

describe("golem token routes", () => {
  test("create, list, disconnect and revoke the tokens of the signed-in account only", async() => {
    await using server = await serveBackend();
    const [alice, bob] = [server.browser(), server.browser()];
    await alice.client.register("Alice", kPassword);
    await bob.client.register("Bob", kPassword);

    const created = await createToken(server, alice, {
      name: "Builder"
    });
    assert.equal(created.status, 201);
    const { token, value } = createdAgentTokenReplySchema.parse(
      await created.json()
    );
    assert.equal(token.name, "Builder");
    assert.equal(value.length, 43);
    assert.equal((await createToken(server, bob, {})).status, 201);

    const aliceTokens = await listed(server, alice);
    assert.deepEqual(aliceTokens, [token]);
    assert.ok(!JSON.stringify(aliceTokens).includes(value));
    assert.equal((await listed(server, bob)).length, 1);

    const disconnectUrl = tokensUrl(server, `${token.id}/disconnect`);
    assert.equal(
      (await bob.fetch(disconnectUrl, { method: "POST" })).status,
      404
    );
    assert.equal(
      (await alice.fetch(disconnectUrl, { method: "POST" })).status,
      204
    );
    assert.deepEqual(await listed(server, alice), [token]);

    const stolen = await bob.fetch(tokensUrl(server, token.id), {
      method: "DELETE"
    });
    assert.equal(stolen.status, 404);
    const revoked = await alice.fetch(tokensUrl(server, token.id), {
      method: "DELETE"
    });
    assert.equal(revoked.status, 204);
    assert.deepEqual(await listed(server, alice), []);
  });

  test("replaces the avatar of a token of the signed-in account only and serves it", async() => {
    await using server = await serveBackend();
    const [alice, bob] = [server.browser(), server.browser()];
    await alice.client.register("Alice", kPassword);
    await bob.client.register("Bob", kPassword);
    const { token } = createdAgentTokenReplySchema.parse(
      await (await createToken(server, alice, {})).json()
    );
    const avatarUrl = tokensUrl(server, `${token.id}/avatar`);
    const upload = {
      method: "PUT",
      headers: {
        "content-type": "image/png"
      },
      body: AVATAR_PNG
    };

    assert.equal((await bob.fetch(avatarUrl, upload)).status, 404);
    const unreadable = await alice.fetch(avatarUrl, {
      ...upload,
      body: "not an image"
    });
    assert.equal(unreadable.status, 422);

    const replaced = await alice.fetch(avatarUrl, upload);
    assert.equal(replaced.status, 200);
    const { avatar } = agentTokenReplySchema.parse(await replaced.json()).token;
    assert.match(
      avatar ?? "",
      new RegExp(`^/api/accounts/agents/${token.id}/avatar\\?v=[0-9a-f]{16}$`)
    );
    assert.deepEqual(await listed(server, alice), [{
      ...token,
      avatar
    }]);

    const served = await fetch(new URL(avatar ?? "", server.url));
    assert.equal(served.status, 200);
    assert.equal(served.headers.get("content-type"), "image/webp");
    assert.equal(
      served.headers.get("cache-control"),
      "public, max-age=31536000, immutable"
    );
    const missing = await fetch(
      new URL("/api/accounts/agents/unknown/avatar", server.url)
    );
    assert.equal(missing.status, 404);
  });

  test("refuses a visitor without a session and a name out of bounds", async() => {
    await using server = await serveBackend();
    const alice = server.browser();
    await alice.client.register("Alice", kPassword);

    assert.equal((await fetch(tokensUrl(server))).status, 401);
    assert.equal(
      (await createToken(server, alice, { name: "x".repeat(33) })).status,
      400
    );
    assert.deepEqual(await listed(server, alice), []);
  });
});
