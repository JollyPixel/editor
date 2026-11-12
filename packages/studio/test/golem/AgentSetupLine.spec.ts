// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import { agentSetupLine } from "../../src/golem/AgentSetupLine.ts";

describe("agentSetupLine", () => {
  test("registers the checkout launcher with the token and the studio URL", () => {
    assert.equal(
      agentSetupLine({
        studioUrl: "http://localhost:5173/",
        token: "secret"
      }),
      "claude mcp add jollypixel --env JOLLY_GOLEM_TOKEN=secret -- " +
      "node <checkout>/packages/golem/dist/bin/jolly-golem.js mcp " +
      "--url http://localhost:5173/"
    );
  });
});
