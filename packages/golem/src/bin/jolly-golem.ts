// Import Node.js Dependencies
import { parseArgs } from "node:util";

// Import Third-party Dependencies
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";

// Import Internal Dependencies
import { Golem } from "../peer/Golem.ts";
import { GolemMcpServer } from "../mcp/GolemMcpServer.ts";

// CONSTANTS
const kUsage = [
  "Usage: jolly-golem <command> [--url <studio url>] [--token <agent token>]",
  "",
  "Commands:",
  "  mcp     run the MCP server on stdio",
  "  status  connect once and print the studio status",
  "",
  "--url defaults to JOLLY_STUDIO_URL, --token to JOLLY_GOLEM_TOKEN."
].join("\n");

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    url: {
      type: "string"
    },
    token: {
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
  token: values.token
};

if (
  values.help ||
  (command !== "mcp" && command !== "status")
) {
  console.error(kUsage);
  process.exitCode = values.help ? 0 : 1;
}
else {
  try {
    if (command === "mcp") {
      const server = new GolemMcpServer(options);
      await server.connect(new StdioServerTransport());
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
