// Import Node.js Dependencies
import fs from "node:fs/promises";
import path from "node:path";

// Import Internal Dependencies
import {
  createTempDir,
  removeTempDir
} from "./tempDir.ts";

export class PackageRoots {
  readonly #roots: string[] = [];

  async create(): Promise<string> {
    const root = await fs.realpath(await createTempDir("studio-editor-"));
    this.#roots.push(root);

    return root;
  }

  async remove(): Promise<void> {
    await Promise.all(this.#roots.splice(0).map((root) => removeTempDir(root)));
  }
}

export async function writeEditorPackage(
  directory: string,
  editor: unknown,
  contributions: Record<string, unknown> = {}
): Promise<string> {
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(
    path.join(directory, "package.json"),
    JSON.stringify({
      name: "editor",
      jollypixel: {
        editor,
        ...contributions
      }
    })
  );

  return directory;
}
