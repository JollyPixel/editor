// Import Node.js Dependencies
import fs from "node:fs";
import path from "node:path";
import { findPackageJSON } from "node:module";

// Import Third-party Dependencies
import * as z from "zod";

// Import Internal Dependencies
import type { EditorDescriptor } from "../src/editors/EditorDescriptor.ts";

// CONSTANTS
const kPackageManifestSchema = z.object({
  jollypixel: z.object({
    editor: z.object({
      name: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
      kinds: z.array(z.string().min(1)).min(1),
      dist: z.string().default("dist")
    })
  })
});

export type PackageLocator = (packageName: string) => string;

export interface EditorPackageData extends EditorDescriptor {
  package: string;
  /**
   * Absolute path of the built page folder.
   */
  dist: string;
}

export class EditorPackage implements EditorPackageData {
  readonly package: string;
  readonly name: string;
  readonly kinds: readonly string[];
  readonly dist: string;

  static locate(
    packageName: string
  ): string {
    let manifest: string | undefined;
    let cause: unknown;
    try {
      manifest = findPackageJSON(
        packageName,
        import.meta.url
      );
    }
    catch (error) {
      cause = error;
    }
    if (manifest === undefined) {
      throw new TypeError(
        `Cannot locate the package "${packageName}".`,
        { cause }
      );
    }

    return fs.realpathSync(
      path.dirname(manifest)
    );
  }

  /**
   * Reads the `jollypixel.editor` field of `package.json`:
   * `{ name, kinds, dist? }`, where `dist` is relative to the package root and defaults to `"dist"`.
   */
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

    return new EditorPackage({
      package: packageName,
      name,
      kinds,
      dist: path.resolve(root, dist)
    });
  }

  constructor(
    data: EditorPackageData
  ) {
    this.package = data.package;
    this.name = data.name;
    this.kinds = [...data.kinds];
    this.dist = data.dist;
  }

  toDescriptor(): EditorDescriptor {
    return {
      name: this.name,
      kinds: [...this.kinds]
    };
  }
}
