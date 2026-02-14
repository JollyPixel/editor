// Import Node.js Dependencies
import path from "node:path";

// Import Third-party Dependencies
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// Import Internal Dependencies
import { registerResources } from "./resources/index.ts";
import { registerTools } from "./tools/index.ts";
import { registerPrompts } from "./prompts/index.ts";

// CONSTANTS
const kEngineRoot = path.resolve(import.meta.dirname, "../../engine");

const server = new McpServer({
  name: "jolly-pixel-engine",
  version: "1.0.0"
});

registerResources(server, kEngineRoot);
registerTools(
  server,
  path.join(kEngineRoot, "docs"),
  path.join(kEngineRoot, "src")
);
registerPrompts(server);

const transport = new StdioServerTransport();
await server.connect(transport);
