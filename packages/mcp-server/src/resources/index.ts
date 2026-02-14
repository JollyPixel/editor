// Import Node.js Dependencies
import fs from "node:fs/promises";
import path from "node:path";

// Import Third-party Dependencies
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerResources(
  server: McpServer,
  engineRoot: string
): void {
  server.registerResource(
    "engine-readme",
    "docs://engine/readme",
    {
      description: "The main README of the @jolly-pixel/engine package"
    },
    async(uri) => {
      const content = await fs.readFile(
        path.join(engineRoot, "README.md"), "utf-8"
      );

      return {
        contents: [{
          uri: uri.href,
          mimeType: "text/markdown",
          text: content
        }]
      };
    }
  );

  server.registerResource(
    "engine-architecture",
    "docs://engine/architecture",
    {
      description: "The architecture document of the @jolly-pixel/runtime package"
    },
    async(uri) => {
      const content = await fs.readFile(
        path.join(engineRoot, "../runtime/ARCHITECTURE.md"), "utf-8"
      );

      return {
        contents: [{
          uri: uri.href,
          mimeType: "text/markdown",
          text: content
        }]
      };
    }
  );
}
