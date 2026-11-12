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
import { serveBackend } from "../../helpers/studioBackend.ts";
import {
  GOLEM_TOKENS_URL_PATH,
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
  test("create, list and revoke the tokens of the signed-in account only", async() => {
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
