// Import Node.js Dependencies
import fs from "node:fs";
import path from "node:path";

// Import Third-party Dependencies
import * as z from "zod";

// Import Internal Dependencies
import type { EditorDescriptor } from "../../src/editors/EditorDescriptor.ts";

// CONSTANTS
const kInstallFolder = "node_modules";
const kPackageManifestSchema = z.object({
  jollypixel: z.object({
    editor: z.object({
      name: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
      kinds: z.array(z.string().min(1)).min(1),
      dist: z.string().default("dist")
    })
  })
});

export interface EditorPackageData extends EditorDescriptor {
  package: string;
  /**
   * Absolute path of the built page folder.
   */
  dist: string;
  /**
   * The page ships built: it must exist when read and is never watched.
   */
  prebuilt: boolean;
}

export class EditorPackage implements EditorPackageData {
  readonly package: string;
  readonly name: string;
  readonly kinds: readonly string[];
  readonly dist: string;
  readonly prebuilt: boolean;

  static read(
    packageName: string,
    root: string
  ): EditorPackage {
    const rawData = fs.readFileSync(
      path.join(root, "package.json"),
      "utf8"
    );
    const manifest = kPackageManifestSchema.safeParse(
      JSON.parse(rawData)
    );
    if (!manifest.success) {
      const reason = z.prettifyError(manifest.error);

      throw new TypeError(
        `"${packageName}" declares an invalid "jollypixel.editor" manifest:\n${reason}`
      );
    }

    const { name, kinds, dist } = manifest.data.jollypixel.editor;
    const editor = new EditorPackage({
      package: packageName,
      name,
      kinds,
      dist: path.resolve(root, dist),
      prebuilt: root.split(/[\\/]/).includes(kInstallFolder)
    });
    if (editor.prebuilt && !fs.existsSync(editor.dist)) {
      throw new TypeError(
        `"${packageName}" has no built page at "${editor.dist}".`
      );
    }

    return editor;
  }

  constructor(
    data: EditorPackageData
  ) {
    this.package = data.package;
    this.name = data.name;
    this.kinds = [...data.kinds];
    this.dist = data.dist;
    this.prebuilt = data.prebuilt;
  }

  toDescriptor(): EditorDescriptor {
    return {
      name: this.name,
      kinds: [...this.kinds]
    };
  }
}
