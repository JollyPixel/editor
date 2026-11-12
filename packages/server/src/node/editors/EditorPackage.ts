// Import Node.js Dependencies
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Import Third-party Dependencies
import { PreferenceScope } from "@jolly-pixel/preferences";
import * as z from "zod";

// Import Internal Dependencies
import type {
  EditorDescriptor,
  SceneComponentDeclaration
} from "../../editors/EditorDescriptor.ts";

// CONSTANTS
const kInstallFolder = "node_modules";
const kNoPreferences = {
  preferences: [],
  sharedPreferences: []
};
const kSceneComponentsSchema = z.record(
  z.string().min(1),
  z.object({
    assets: z.record(z.string().min(1), z.string().min(1)).default({})
  })
).transform((components) => Object.entries(components).map(
  ([type, { assets }]): SceneComponentDeclaration => {
    return {
      type,
      assets
    };
  }
));
const kPackageManifestSchema = z.object({
  jollypixel: z.object({
    editor: z.object({
      name: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
      kinds: z.array(z.string().min(1)).min(1),
      dist: z.string().default("dist"),
      page: z.string().min(1).optional(),
      preferences: z.string().min(1).optional()
    }),
    scene: z.string().min(1).optional(),
    sceneComponents: kSceneComponentsSchema.optional(),
    preview: z.array(z.string().min(1)).optional()
  }).refine(
    (jollypixel) => jollypixel.preview === undefined ||
      jollypixel.scene !== undefined,
    {
      message: "\"preview\" lists kinds of the \"scene\" contribution.",
      path: ["preview"]
    }
  ).refine(
    (jollypixel) => jollypixel.scene === undefined ||
      jollypixel.sceneComponents !== undefined,
    {
      message: "a \"scene\" contribution declares its \"sceneComponents\".",
      path: ["sceneComponents"]
    }
  )
});

export type EditorPage =
  | {
    kind: "source";
    html: string;
  }
  | {
    kind: "built";
  }
  | {
    kind: "prebuilt";
  };

export interface EditorPackageData extends EditorDescriptor {
  package: string;
  /**
   * Absolute path of the built page folder.
   */
  dist: string;
  /**
   * How the studio gets the page. A `source` page names its source HTML,
   * which the studio's Vite compiles in dev and build. A `built` page is
   * served from `dist` and watched in dev. A `prebuilt` page, installed in
   * `node_modules`, is served from `dist` and never watched.
   */
  page: EditorPage;
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
  /**
   * The kinds the preview frame renders with this package's scene
   * contribution.
   */
  previewKinds: readonly string[];
  sceneComponents: readonly SceneComponentDeclaration[];
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
  readonly page: EditorPage;
  readonly preferences: readonly PreferenceScope[];
  readonly sharedPreferences: readonly PreferenceScope[];
  readonly previewKinds: readonly string[];
  readonly sceneComponents: readonly SceneComponentDeclaration[];

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
        `"${packageName}" declares an invalid "jollypixel" manifest:\n${reason}`
      );
    }

    const {
      name,
      kinds,
      dist,
      page,
      preferences
    } = manifest.data.jollypixel.editor;
    const {
      preview = [],
      sceneComponents = []
    } = manifest.data.jollypixel;
    const editorPage = resolvePage(packageName, root, page);
    const scopes = preferences === undefined ?
      kNoPreferences :
      await loadPreferences(packageName, path.resolve(root, preferences));

    return new EditorPackage({
      package: packageName,
      name,
      kinds,
      dist: path.resolve(root, dist),
      page: editorPage,
      previewKinds: preview,
      sceneComponents,
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
    this.page = data.page;
    this.preferences = [...data.preferences];
    this.sharedPreferences = [...data.sharedPreferences];
    this.previewKinds = [...data.previewKinds];
    this.sceneComponents = [...data.sceneComponents];
  }

  toDescriptor(): EditorDescriptor {
    return {
      name: this.name,
      kinds: [...this.kinds],
      preferences: this.preferences.map((scope) => scope.toJSON()),
      sharedPreferences: this.sharedPreferences.map((scope) => scope.toJSON()),
      sceneComponents: [...this.sceneComponents]
    };
  }
}

function resolvePage(
  packageName: string,
  root: string,
  page: string | undefined
): EditorPage {
  const prebuilt = root.split(/[\\/]/).includes(kInstallFolder);
  if (page !== undefined) {
    const html = path.resolve(root, page);
    if (fs.existsSync(html)) {
      return {
        kind: "source",
        html
      };
    }
    if (!prebuilt) {
      throw new TypeError(
        `"${packageName}" has no page source at "${html}".`
      );
    }
  }

  return {
    kind: prebuilt ? "prebuilt" : "built"
  };
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
