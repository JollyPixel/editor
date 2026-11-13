// Import Node.js Dependencies
import fs from "node:fs";
import path from "node:path";

// Import Third-party Dependencies
import {
  ResourceTemplate,
  type McpServer,
  type ReadResourceResult,
  type Variables
} from "@modelcontextprotocol/server";
import * as z from "zod/mini";

// Import Internal Dependencies
import {
  GOLEM_KINDS,
  golemCommandSchema,
  isGolemKind
} from "../assets/kinds.ts";
import { UnsupportedKindError } from "../assets/errors/UnsupportedKindError.ts";
import { WorkspaceDocs } from "./WorkspaceDocs.ts";

// CONSTANTS
export const PACKAGE_ROOT = path.join(import.meta.dirname, "..", "..");

const kGuideFile = path.join(PACKAGE_ROOT, "skill", "SKILL.md");
const kWorkspacesRoot = path.join(PACKAGE_ROOT, "..");
const kGuideUri = "jollypixel://guide";

export function schemaUri(
  kind: string
): string {
  return `jollypixel://schemas/${kind}`;
}

export function registerResources(
  server: McpServer
): void {
  const docs = new WorkspaceDocs(kWorkspacesRoot);

  server.registerResource(
    "guide",
    kGuideUri,
    {
      description: "How to work in a JollyPixel studio: read first.",
      mimeType: "text/markdown"
    },
    (uri) => markdown(uri, fs.readFileSync(kGuideFile, "utf-8"))
  );

  server.registerResource(
    "schemas",
    new ResourceTemplate("jollypixel://schemas/{kind}", {
      list: () => {
        return {
          resources: GOLEM_KINDS.map((kind) => {
            return {
              uri: schemaUri(kind),
              name: `${kind} commands`,
              mimeType: "application/schema+json"
            };
          })
        };
      }
    }),
    {
      description: "The JSON Schema of one kind's commands, for asset_apply.",
      mimeType: "application/schema+json"
    },
    (uri, variables) => {
      const kind = variable(variables, "kind");
      if (!isGolemKind(kind)) {
        throw new UnsupportedKindError(kind, GOLEM_KINDS);
      }
      const schema = z.toJSONSchema(golemCommandSchema(kind), {
        io: "input"
      });

      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "application/schema+json",
            text: JSON.stringify(schema)
          }
        ]
      };
    }
  );

  server.registerResource(
    "docs",
    new ResourceTemplate("jollypixel://docs/{workspace}/{+file}", {
      list: () => {
        return {
          resources: Array.from(docs.list(), ({ workspace, file }) => {
            return {
              uri: `jollypixel://docs/${workspace}/${file}`,
              name: `${workspace} ${path.basename(file, ".md")}`,
              mimeType: "text/markdown"
            };
          })
        };
      }
    }),
    {
      description: "The API documentation of a JollyPixel package.",
      mimeType: "text/markdown"
    },
    (uri, variables) => {
      const text = docs.read({
        workspace: variable(variables, "workspace"),
        file: decodeURIComponent(variable(variables, "file"))
      });
      if (text === null) {
        throw new Error(`No documentation at ${uri.href}.`);
      }

      return markdown(uri, text);
    }
  );
}

function variable(
  variables: Variables,
  name: string
): string {
  const value = variables[name];

  return Array.isArray(value) ? value.join("/") : String(value);
}

function markdown(
  uri: URL,
  text: string
): ReadResourceResult {
  return {
    contents: [
      {
        uri: uri.href,
        mimeType: "text/markdown",
        text
      }
    ]
  };
}
