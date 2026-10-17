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
      dist: z.string().default("dist"),
      page: z.string().min(1).optional()
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
   * The page ships built and is never watched.
   */
  prebuilt: boolean;
  /**
   * Absolute path of the page's source HTML, which the studio build compiles
   * together with the shell. Null when the manifest names none, or when a
   * prebuilt package ships only its built page.
   */
  page: string | null;
}

export class EditorPackage implements EditorPackageData {
  readonly package: string;
  readonly name: string;
  readonly kinds: readonly string[];
  readonly dist: string;
  readonly prebuilt: boolean;
  readonly page: string | null;

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

    const {
      name,
      kinds,
      dist,
      page
    } = manifest.data.jollypixel.editor;
    const prebuilt = root.split(/[\\/]/).includes(kInstallFolder);
    const source = page === undefined ?
      null :
      path.resolve(root, page);
    const shipsPage = source !== null && fs.existsSync(source);
    if (source !== null && !shipsPage && !prebuilt) {
      throw new TypeError(
        `"${packageName}" has no page source at "${source}".`
      );
    }

    return new EditorPackage({
      package: packageName,
      name,
      kinds,
      dist: path.resolve(root, dist),
      prebuilt,
      page: shipsPage ? source : null
    });
  }

  constructor(
    data: EditorPackageData
  ) {
    this.package = data.package;
    this.name = data.name;
    this.kinds = [...data.kinds];
    this.dist = data.dist;
    this.prebuilt = data.prebuilt;
    this.page = data.page;
  }

  toDescriptor(): EditorDescriptor {
    return {
      name: this.name,
      kinds: [...this.kinds]
    };
  }
}
