// Import Node.js Dependencies
import fs from "node:fs/promises";
import path from "node:path";

// Import Third-party Dependencies
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Import Internal Dependencies
import {
  collectFiles,
  isPathInside,
  searchFiles
} from "../utils.ts";

function safePath(
  root: string,
  relativePath: string
): string {
  const resolved = path.resolve(root, relativePath);
  if (!isPathInside(resolved, root)) {
    throw new Error(`Path traversal denied: ${relativePath}`);
  }

  return resolved;
}

export function registerTools(
  server: McpServer,
  docsRoot: string,
  srcRoot: string
): void {
  server.registerTool(
    "list-docs",
    {
      description: "List all available documentation files for the engine"
    },
    async() => {
      const docs = await collectFiles(docsRoot, ".md");

      return {
        content: [{
          type: "text",
          text: JSON.stringify(docs, null, 2)
        }]
      };
    }
  );

  server.registerTool(
    "read-doc",
    {
      description: "Read a specific documentation file by relative path (e.g. 'actor/actor.md')",
      inputSchema: {
        docPath: z.string().describe("Relative path to the doc file from engine/docs/")
      }
    },
    async({ docPath }) => {
      const fullPath = safePath(docsRoot, docPath);
      const content = await fs.readFile(fullPath, "utf-8");

      return {
        content: [{
          type: "text",
          text: content
        }]
      };
    }
  );

  server.registerTool(
    "read-source",
    {
      description: "Read a specific source file by relative path (e.g. 'actor/Actor.ts')",
      inputSchema: {
        srcPath: z.string().describe("Relative path to the source file from engine/src/")
      }
    },
    async({ srcPath }) => {
      const fullPath = safePath(srcRoot, srcPath);
      const content = await fs.readFile(fullPath, "utf-8");

      return {
        content: [{
          type: "text",
          text: content
        }]
      };
    }
  );

  server.registerTool(
    "list-source-files",
    {
      description: "List all TypeScript source files in the engine"
    },
    async() => {
      const files = await collectFiles(srcRoot, ".ts");

      return {
        content: [{
          type: "text",
          text: JSON.stringify(files, null, 2)
        }]
      };
    }
  );

  server.registerTool(
    "search-code",
    {
      description: "Search for a pattern (string or regex) across engine source files",
      inputSchema: {
        pattern: z.string().describe("The search pattern (plain text or regex)"),
        isRegex: z.boolean().optional().describe("Whether the pattern is a regex")
      }
    },
    async({ pattern, isRegex }) => {
      const results = await searchFiles({
        dir: srcRoot,
        extension: ".ts",
        pattern,
        isRegex
      });

      return {
        content: [{
          type: "text",
          text: JSON.stringify(results, null, 2)
        }]
      };
    }
  );

  server.registerTool(
    "get-api-summary",
    {
      description: "Get a summary of the public API for a specific module (actor, components, systems, controls, audio, ui)",
      inputSchema: {
        module: z.enum(["actor", "components", "systems", "controls", "audio", "ui"])
          .describe("The engine module to summarize")
      }
    },
    async({ module }) => {
      const indexPath = path.join(srcRoot, module, "index.ts");
      const indexContent = await fs.readFile(indexPath, "utf-8");

      // Also read related docs
      const docsDir = path.join(docsRoot, module);
      let docsContent = "";
      try {
        const docFiles = await collectFiles(docsDir, ".md");
        for (const docFile of docFiles) {
          const content = await fs.readFile(path.join(docsDir, docFile), "utf-8");
          docsContent += `\n\n--- ${docFile} ---\n${content}`;
        }
      }
      catch {
        // No docs directory for this module
      }

      return {
        content: [{
          type: "text",
          text: `## Module: ${module}\n\n### Exports (index.ts):\n${indexContent}\n\n### Documentation:\n${docsContent}`
        }]
      };
    }
  );
}
