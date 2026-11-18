// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";

// Import Internal Dependencies
import {
  agentBridgeLine,
  agentSetupLine
} from "../../src/golem/AgentSetupLine.ts";

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

describe("agentBridgeLine", () => {
  test("runs the checkout launcher's bridge with the studio URL and the token", () => {
    assert.equal(
      agentBridgeLine({
        studioUrl: "http://localhost:5173/",
        token: "secret"
      }),
      "node <checkout>/packages/golem/dist/bin/jolly-golem.js bridge " +
      "--url http://localhost:5173/ --token secret --agent claude"
    );
  });
});
