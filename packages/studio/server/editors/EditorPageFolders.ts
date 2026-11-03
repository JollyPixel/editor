// Import Node.js Dependencies
import fs from "node:fs/promises";
import path from "node:path";

// Import Internal Dependencies
import {
  EDITOR_PAGE_FILE,
  EDITOR_PAGES_DIR
} from "../../shared/EditorDescriptor.ts";
import type { EditorPackage } from "./EditorPackage.ts";

export type PageEditor = Pick<EditorPackage, "name" | "dist">;

export interface EditorPageSource {
  html(editor: PageEditor): Promise<string>;
}

export class EditorPageFolders implements EditorPageSource {
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
    return path.join(this.#folder(editor), EDITOR_PAGE_FILE);
  }

  html(
    editor: PageEditor
  ): Promise<string> {
    return fs.readFile(this.index(editor), "utf8");
  }
}
