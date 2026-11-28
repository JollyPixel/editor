// Import Node.js Dependencies
import { parseArgs } from "node:util";

// Import Third-party Dependencies
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";

// Import Internal Dependencies
import { Golem } from "../peer/Golem.ts";
import {
  GOLEM_CHAT_MODES,
  GolemMcpServer
} from "../mcp/GolemMcpServer.ts";
import { runBridge } from "./runBridge.ts";

// CONSTANTS
const kUsage = [
  "Usage: jolly-golem <command> [--url <studio url>] [--token <agent token>]",
  "                   [--project <folder>]",
  "",
  "Commands:",
  "  mcp [--chat <mode>]             run the MCP server on stdio",
  "  bridge [--agent <agent>] [--cwd <folder>]",
  "                                  run an ACP agent for the token's owner",
  "  status                          connect once and print the studio status",
  "",
  "--url defaults to JOLLY_STUDIO_URL, --token to JOLLY_GOLEM_TOKEN.",
  "--project, where the project's kind packages resolve from, defaults to",
  "JOLLY_PROJECT, then the current folder.",
  "--agent is claude (default), codex, or a command that speaks ACP on stdio.",
  "--chat is standalone (default), channel, which also pushes the owner's",
  "chat messages to Claude Code as channel events, or bridged, for the bridge."
].join("\n");
const kCommands = new Set(["mcp", "bridge", "status"]);

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    url: {
      type: "string"
    },
    token: {
      type: "string"
    },
    project: {
      type: "string"
    },
    chat: {
      type: "string",
      default: "standalone"
    },
    agent: {
      type: "string"
    },
    cwd: {
      type: "string"
    },
    help: {
      type: "boolean",
      short: "h"
    }
  }
});
const [command] = positionals;
const options = {
  url: values.url,
  token: values.token,
  projectRoot: values.project
};

if (values.help || !kCommands.has(command)) {
  console.error(kUsage);
  process.exitCode = values.help ? 0 : 1;
}
else {
  try {
    if (command === "mcp") {
      const chat = GOLEM_CHAT_MODES.find((mode) => mode === values.chat);
      if (chat === undefined) {
        throw new TypeError(`Unknown chat mode: ${values.chat}`);
      }
      const server = new GolemMcpServer({
        ...options,
        chat
      });
      await server.connect(new StdioServerTransport());
    }
    else if (command === "bridge") {
      await runBridge({
        ...options,
        agent: values.agent ?? "claude",
        cwd: values.cwd ?? process.cwd(),
        script: import.meta.filename
      });
    }
    else {
      using golem = await Golem.connect(options);
      console.log(JSON.stringify(golem.status(), null, 2));
    }
  }
  catch (error) {
    console.error(String(error));
    process.exitCode = 1;
  }
}
