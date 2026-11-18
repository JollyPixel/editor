// Import Node.js Dependencies
import {
  describe,
  test
} from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

// Import Third-party Dependencies
import type {
  PermissionOption,
  RequestPermissionResponse,
  ToolCallUpdate
} from "@agentclientprotocol/sdk";
import { AGENT_BRIDGE_OPTIONS_MAX_LENGTH } from "@jolly-pixel/server";

// Import Internal Dependencies
import { AgentProcess } from "#src/bridge/AgentProcess.ts";
import {
  BRIDGED_MCP,
  BridgeStudio,
  optionNamed
} from "../helpers/BridgeStudio.ts";
import { FakeAgent } from "../helpers/FakeAgent.ts";
import { serveStudio } from "../helpers/studio.ts";

// CONSTANTS
const kTimeoutMs = 15_000;
const kEchoAgent = path.join(import.meta.dirname, "..", "fixtures", "echoAgent.ts");
const kOptions: PermissionOption[] = [
  {
    optionId: "allow",
    name: "Allow",
    kind: "allow_once"
  },
  {
    optionId: "reject",
    name: "Reject",
    kind: "reject_once"
  }
];

function mcpCall(
  toolCallId: string,
  server: string
): ToolCallUpdate {
  return {
    toolCallId,
    title: `mcp__${server}__call`,
    _meta: {
      claudeCode: {
        mcpServer: {
          name: server,
          source: "config"
        }
      }
    }
  };
}

describe("GolemBridge", { timeout: kTimeoutMs }, () => {
  test("prompts the agent with its owner's messages and posts the replies in the chat", async() => {
    await using backend = await serveStudio();
    using studio = await BridgeStudio.open(backend);
    const agent = new FakeAgent(async(turn) => {
      await turn.say("On ");
      await turn.say("it.");
      await turn.startTool({
        toolCallId: "tool-1",
        title: "scene_add_actors"
      });
      await turn.say("Tower built.");

      return "end_turn";
    });
    await using _bridge = await studio.bridge(agent.stream());

    await studio.other.chat.say("Delete everything");
    await studio.owner.chat.say("Build a tower");
    await studio.owner.until(() => studio.owner.chat.messages.length === 4);

    assert.deepEqual(studio.lines(), [
      ["Bob", "Delete everything"],
      ["Alice", "Build a tower"],
      ["Builder", "On it."],
      ["Builder", "Tower built."]
    ]);
    assert.deepEqual(agent.prompts, ["Build a tower"]);
    assert.deepEqual(agent.mcpServers, [
      {
        name: "jollypixel",
        ...BRIDGED_MCP,
        env: [
          {
            name: "JOLLY_STUDIO_URL",
            value: new URL(backend.url).href
          },
          {
            name: "JOLLY_GOLEM_TOKEN",
            value: studio.builder.value
          }
        ]
      }
    ]);
  });

  test("asks its owner before a tool runs, ignoring answers and stops from anyone else", async() => {
    await using backend = await serveStudio();
    using studio = await BridgeStudio.open(backend);
    const answered = Promise.withResolvers<RequestPermissionResponse>();
    await using _bridge = await studio.bridge(new FakeAgent(async(turn) => {
      answered.resolve(await turn.ask({
        toolCall: {
          toolCallId: "tool-1",
          title: "Run pnpm install"
        },
        options: kOptions
      }));

      return "end_turn";
    }).stream());

    await studio.owner.chat.say("Install the dependencies");
    const { bridgeClientId, request } = await studio.pendingPermission();
    studio.other.chat.answer(bridgeClientId, request.id, optionNamed(request, "Allow"));
    studio.other.chat.cancel(bridgeClientId);
    await studio.other.chat.say("Too slow");
    await studio.owner.until(
      () => studio.owner.chat.messages.at(-1)?.text === "Too slow"
    );
    studio.owner.chat.answer(bridgeClientId, request.id, optionNamed(request, "Reject"));

    assert.equal(request.title, "Run pnpm install");
    assert.deepEqual(await answered.promise, {
      outcome: {
        outcome: "selected",
        optionId: "reject"
      }
    });
    await studio.untilIdle();
  });

  test("allows calls to the golem's own MCP server without asking its owner", async() => {
    await using backend = await serveStudio();
    using studio = await BridgeStudio.open(backend);
    const responses: RequestPermissionResponse[] = [];
    await using _bridge = await studio.bridge(new FakeAgent(async(turn) => {
      responses.push(await turn.ask({
        toolCall: mcpCall("claude-1", "jollypixel"),
        options: kOptions
      }));
      await turn.startTool({
        toolCallId: "codex-1",
        title: "MCP asset_apply on jollypixel",
        rawInput: {
          server: "jollypixel",
          tool: "asset_apply",
          arguments: {}
        }
      });
      responses.push(await turn.ask({
        _meta: {
          is_mcp_tool_approval: true
        },
        toolCall: {
          toolCallId: "codex-1"
        },
        options: kOptions
      }));
      responses.push(await turn.ask({
        toolCall: mcpCall("claude-2", "github"),
        options: kOptions
      }));

      return "end_turn";
    }).stream());

    await studio.owner.chat.say("Edit the map");
    const { bridgeClientId, request } = await studio.pendingPermission();
    studio.owner.chat.answer(bridgeClientId, request.id, optionNamed(request, "Reject"));
    await studio.untilIdle();

    assert.equal(request.title, "mcp__github__call");
    assert.deepEqual(
      responses.map(({ outcome }) => (
        outcome.outcome === "selected" ? outcome.optionId : outcome.outcome
      )),
      ["allow", "allow", "reject"]
    );
  });

  test("cancels a permission request with more options than the pane can show", async() => {
    await using backend = await serveStudio();
    using studio = await BridgeStudio.open(backend);
    const answered = Promise.withResolvers<RequestPermissionResponse>();
    await using _bridge = await studio.bridge(new FakeAgent(async(turn) => {
      answered.resolve(await turn.ask({
        toolCall: {
          toolCallId: "tool-1",
          title: "Pick a branch"
        },
        options: Array.from({ length: AGENT_BRIDGE_OPTIONS_MAX_LENGTH + 1 }, (_, index) => {
          return {
            optionId: `branch-${index}`,
            name: `Branch ${index}`,
            kind: "allow_once"
          };
        })
      }));

      return "end_turn";
    }).stream());

    await studio.owner.chat.say("Check out a branch");

    assert.deepEqual(await answered.promise, {
      outcome: {
        outcome: "cancelled"
      }
    });
    await studio.untilIdle();
  });

  test("on its owner's stop, cancels the turn, its pending request and the queued messages", async() => {
    await using backend = await serveStudio();
    using studio = await BridgeStudio.open(backend);
    const responses: RequestPermissionResponse[] = [];
    const agent = new FakeAgent(async(turn) => {
      responses.push(await turn.ask({
        toolCall: {
          toolCallId: "tool-1",
          title: "Delete the build folder"
        },
        options: kOptions
      }));
      await turn.cancelled;

      return "cancelled";
    });
    await using _bridge = await studio.bridge(agent.stream());

    await studio.owner.chat.say("Clean up");
    const { bridgeClientId } = await studio.pendingPermission();
    await studio.owner.chat.say("Then rebuild");
    studio.owner.chat.cancel(bridgeClientId);
    await studio.untilIdle();

    assert.deepEqual(responses, [
      {
        outcome: {
          outcome: "cancelled"
        }
      }
    ]);
    assert.deepEqual(agent.prompts, ["Clean up"]);
  });

  test("runs an agent command over stdio", async() => {
    await using backend = await serveStudio();
    using studio = await BridgeStudio.open(backend);
    await using agent = AgentProcess.spawn(
      `"${process.execPath}" "${kEchoAgent}"`,
      import.meta.dirname
    );
    await using _bridge = await studio.bridge(agent.stream);

    await studio.owner.chat.say("ping");
    await studio.owner.until(() => studio.owner.chat.messages.length === 2);

    assert.deepEqual(studio.lines().at(-1), ["Builder", "Echo: ping"]);
  });
});
