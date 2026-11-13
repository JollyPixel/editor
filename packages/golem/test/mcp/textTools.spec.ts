// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { McpAgent } from "../helpers/McpAgent.ts";
import {
  createAgentToken,
  registered,
  serveStudio
} from "../helpers/studio.ts";

describe("text tools", { timeout: 15_000 }, () => {
  test("writes, replaces and reads back a range of lines", async() => {
    await using backend = await serveStudio();
    const bob = await registered(backend, "Bob");
    await using agent = await McpAgent.connect({
      url: backend.url,
      token: (await createAgentToken(backend, bob, "Builder")).value
    });
    const { assetId } = await agent.call<{ assetId: string; }>(
      "catalog_create",
      { path: "notes/todo.md" }
    );

    await agent.call("text_write", {
      assetId,
      text: "# Todo\n- bread\n- milk\n- bread\n"
    });
    await agent.call("text_replace", {
      assetId,
      search: "- milk\n",
      replace: ""
    });

    assert.deepEqual(await agent.call("text_read", {
      assetId,
      from: 2,
      to: 9
    }), {
      assetId,
      kind: "text",
      from: 2,
      to: 4,
      lineCount: 4,
      text: "- bread\n- bread\n"
    });
  });
});
