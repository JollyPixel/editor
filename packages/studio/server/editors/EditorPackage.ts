// Import Node.js Dependencies
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Import Third-party Dependencies
import { PreferenceScope } from "@jolly-pixel/preferences";
import * as z from "zod";

// Import Internal Dependencies
import type { EditorDescriptor } from "../../shared/EditorDescriptor.ts";

// CONSTANTS
const kInstallFolder = "node_modules";
const kNoPreferences = {
  preferences: [],
  sharedPreferences: []
};
const kPackageManifestSchema = z.object({
  jollypixel: z.object({
    editor: z.object({
      name: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
      kinds: z.array(z.string().min(1)).min(1),
      dist: z.string().default("dist"),
      page: z.string().min(1).optional(),
      preferences: z.string().min(1).optional()
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
  /**
   * The scopes the module named by the manifest's `preferences` exports by
   * default: the ones this editor declares.
   */
  preferences: readonly PreferenceScope[];
  /**
   * The scopes the same module exports as `shared`: declared by another
   * editor and read by this one too.
   */
  sharedPreferences: readonly PreferenceScope[];
}

type EditorPreferences = Pick<
  EditorPackageData,
  "preferences" | "sharedPreferences"
>;

export class EditorPackage implements EditorPackageData {
  readonly package: string;
  readonly name: string;
  readonly kinds: readonly string[];
  readonly dist: string;
  readonly prebuilt: boolean;
  readonly page: string | null;
  readonly preferences: readonly PreferenceScope[];
  readonly sharedPreferences: readonly PreferenceScope[];

  static async read(
    packageName: string,
    root: string
  ): Promise<EditorPackage> {
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
      page,
      preferences
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

    const scopes = preferences === undefined ?
      kNoPreferences :
      await loadPreferences(packageName, path.resolve(root, preferences));

    return new EditorPackage({
      package: packageName,
      name,
      kinds,
      dist: path.resolve(root, dist),
      prebuilt,
      page: shipsPage ? source : null,
      ...scopes
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
    this.preferences = [...data.preferences];
    this.sharedPreferences = [...data.sharedPreferences];
  }

  toDescriptor(): EditorDescriptor {
    return {
      name: this.name,
      kinds: [...this.kinds],
      preferences: this.preferences.map((scope) => scope.toJSON()),
      sharedPreferences: this.sharedPreferences.map((scope) => scope.toJSON())
    };
  }
}

async function loadPreferences(
  packageName: string,
  file: string
): Promise<EditorPreferences> {
  try {
    const module: {
      default?: unknown;
      shared?: unknown;
    } = await import(pathToFileURL(file).href);

    return {
      preferences: parseScopes(module.default),
      sharedPreferences: module.shared === undefined ?
        [] :
        parseScopes(module.shared)
    };
  }
  catch (error) {
    throw new TypeError(
      `"${packageName}" exports no valid preference scopes from "${file}".`,
      { cause: error }
    );
  }
}

function parseScopes(
  exported: unknown
): PreferenceScope[] {
  const scopes = Array.isArray(exported) ? exported : [exported];

  return scopes.map(
    (scope) => PreferenceScope.from(JSON.parse(JSON.stringify(scope)))
  );
}
