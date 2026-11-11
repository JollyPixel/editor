// Import Node.js Dependencies
import fs from "node:fs/promises";
import path from "node:path";

// Import Third-party Dependencies
import {
  EditorPackages,
  type EditorPage
} from "@jolly-pixel/server/node";
import { voxelMapEditor } from "@jolly-pixel/server/testing";

// Import Internal Dependencies
import { EditorPageFiles } from "../../vite/EditorPageFiles.ts";

// CONSTANTS
export const EDITOR_CSS = "body { margin: 0; }";

export async function writeEditorPage(
  editor: string,
  script: string
): Promise<string> {
  const page = path.join(editor, "index.html");
  await fs.mkdir(path.join(editor, "src"));
  await fs.mkdir(path.join(editor, "public"));
  await fs.writeFile(
    page,
    "<link rel=\"stylesheet\" href=\"./main.css\">" +
    "<link rel=\"stylesheet\" href=\"./src/editor.css\">" +
    "<script type=\"module\" src=\"./src/index.ts\"></script>"
  );
  await fs.writeFile(path.join(editor, "public", "main.css"), EDITOR_CSS);
  await fs.writeFile(path.join(editor, "src", "editor.css"), EDITOR_CSS);
  await fs.writeFile(path.join(editor, "src", "index.ts"), script);

  return page;
}

export function voxelMapPages(
  dist: string,
  html?: string
): EditorPageFiles {
  const page: EditorPage = html === undefined ?
    {
      kind: "built"
    } :
    {
      kind: "source",
      html
    };

  return new EditorPageFiles(
    new EditorPackages([voxelMapEditor(dist, { page })])
  );
}
