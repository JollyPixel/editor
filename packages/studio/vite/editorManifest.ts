// Import Node.js Dependencies
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

// Import Third-party Dependencies
import * as z from "zod";

// Import Internal Dependencies
import type { EditorDescriptor } from "../src/editors/EditorDescriptor.ts";

// CONSTANTS
const kRequire = createRequire(import.meta.url);
const kPackageManifestSchema = z.object({
  jollypixel: z.object({
    editor: z.object({
      name: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
      kinds: z.array(z.string().min(1)).min(1),
      dist: z.string().default("dist")
    })
  })
});

export interface EditorPackage extends EditorDescriptor {
  package: string;
  /**
   * Absolute path of the built page folder.
   */
  dist: string;
}

export function locatePackage(
  packageName: string
): string {
  return path.dirname(
    kRequire.resolve(`${packageName}/package.json`)
  );
}

/**
 * Reads the `jollypixel.editor` field of each package's `package.json`:
 * `{ name, kinds, dist? }`, where `dist` is relative to the package root and defaults to `"dist"`.
 */
export function readEditorPackages(
  packageNames: Iterable<string>,
  locate: (packageName: string) => string = locatePackage
): EditorPackage[] {
  const editors = new Map<string, EditorPackage>();
  for (const packageName of packageNames) {
    const editor = readEditorPackage(
      packageName,
      locate(packageName)
    );
    const declared = editors.get(editor.name);
    if (declared !== undefined) {
      throw new TypeError(
        `Editor "${editor.name}" is declared by both "${declared.package}" and "${packageName}".`
      );
    }

    editors.set(
      editor.name,
      editor
    );
  }

  return [
    ...editors.values()
  ];
}

function readEditorPackage(
  packageName: string,
  root: string
): EditorPackage {
  const manifest = kPackageManifestSchema.safeParse(JSON.parse(
    fs.readFileSync(path.join(root, "package.json"), "utf8")
  ));
  if (!manifest.success) {
    const reason = z.prettifyError(manifest.error);

    throw new TypeError(
      `"${packageName}" declares an invalid "jollypixel.editor" manifest:\n${reason}`
    );
  }

  const { name, kinds, dist } = manifest.data.jollypixel.editor;

  return {
    package: packageName,
    name,
    kinds,
    dist: path.resolve(root, dist)
  };
}
