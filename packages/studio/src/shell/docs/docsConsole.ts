// Import Third-party Dependencies
import type { EditorConsole } from "@jolly-pixel/editor.host";

// Import Internal Dependencies
import type { DocsLibrary } from "./DocsLibrary.ts";

// CONSTANTS
export const DOCS_NAMESPACE = "docs";

type Commands = EditorConsole["commands"];
type Namespace = ReturnType<Commands["registerNamespace"]>;

export interface DocsOpener {
  openDocs(
    page?: string
  ): void;
}

export function docsConsole(
  commands: Commands,
  opener: DocsOpener,
  library: DocsLibrary
): Namespace {
  const namespace = commands.registerNamespace(DOCS_NAMESPACE, {
    description: "The studio's Docs tab"
  });

  namespace.registerCommand("open", {
    description: "Open the Docs tab, on a page when one is given",
    args: [
      {
        name: "page",
        type: "enum",
        enumValues: library.ids
      }
    ],
    execute: ({ page }) => {
      opener.openDocs(page);
    }
  });

  return namespace;
}
