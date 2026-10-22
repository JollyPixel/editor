// Import Node.js Dependencies
import path from "node:path";

// Import Internal Dependencies
import { EDITOR_PAGES_DIR } from "../../shared/EditorDescriptor.ts";
import type { EditorPackage } from "./EditorPackage.ts";

// CONSTANTS
const kIndexFile = "index.html";

export type PageEditor = Pick<EditorPackage, "name" | "dist">;

export class EditorPageFolders {
  static packages(): EditorPageFolders {
    return new EditorPageFolders((editor) => editor.dist);
  }

  static shell(
    shellDir: string
  ): EditorPageFolders {
    return new EditorPageFolders(
      (editor) => path.join(shellDir, EDITOR_PAGES_DIR, editor.name)
    );
  }

  #folder: (editor: PageEditor) => string;

  private constructor(
    folder: (editor: PageEditor) => string
  ) {
    this.#folder = folder;
  }

  index(
    editor: PageEditor
  ): string {
    return path.join(this.#folder(editor), kIndexFile);
  }
}
