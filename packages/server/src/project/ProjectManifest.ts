// Import Third-party Dependencies
import { PreferenceScope } from "@jolly-pixel/preferences";
import * as z from "zod";
import type { LoadedAssetKind } from "@jolly-pixel/asset-server";

// Import Internal Dependencies
import type { EditorDescriptor } from "../editors/EditorDescriptor.ts";
import type { EditorPreferenceScopes } from "../preferences/PreferenceScopes.ts";

// CONSTANTS
export const PROJECT_MANIFEST_FILE = "project-manifest.json";
const kProjectManifestSchema = z.object({
  editors: z.array(z.object({
    name: z.string(),
    kinds: z.array(z.string()),
    preferences: z.array(z.unknown()).default([]),
    sharedPreferences: z.array(z.unknown()).default([])
  })),
  kinds: z.array(z.object({
    kind: z.string(),
    label: z.string(),
    extension: z.string(),
    icon: z.object({
      svg: z.string(),
      tone: z.string().optional(),
      viewBox: z.string().optional()
    }).optional(),
    creatable: z.boolean().optional(),
    convertsFrom: z.array(z.string()),
    extensions: z.array(z.string()),
    maxContentBytes: z.number().optional(),
    preview: z.enum(["server", "frame"]).optional()
  })),
  kindPackages: z.array(z.object({
    name: z.string(),
    kinds: z.array(z.string())
  })),
  maxContentBytes: z.number()
});

export type KindPreview = "server" | "frame";

export interface ManifestKind extends Omit<LoadedAssetKind, "preview"> {
  /**
   * `"server"` when the kind's handler draws previews, `"frame"` when an
   * editor package lists the kind in `jollypixel.preview`.
   */
  preview?: KindPreview;
}

export interface KindPackageDescriptor {
  name: string;
  kinds: readonly string[];
}

export interface EditorScopes extends EditorPreferenceScopes {
  kinds: readonly string[];
}

export interface ProjectManifestData {
  editors: readonly EditorDescriptor[];
  kinds: readonly ManifestKind[];
  kindPackages: readonly KindPackageDescriptor[];
  maxContentBytes: number;
}

export class ProjectManifest implements ProjectManifestData {
  readonly editors: readonly EditorDescriptor[];
  readonly kinds: readonly ManifestKind[];
  readonly kindPackages: readonly KindPackageDescriptor[];
  readonly maxContentBytes: number;

  static async fetch(
    base: string | URL
  ): Promise<ProjectManifest> {
    const url = new URL(PROJECT_MANIFEST_FILE, base);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Unable to load "${url.pathname}" (${response.status}).`);
    }

    return ProjectManifest.parse(await response.json());
  }

  static parse(
    value: unknown
  ): ProjectManifest {
    const manifest = kProjectManifestSchema.safeParse(value);
    if (!manifest.success) {
      const reason = z.prettifyError(manifest.error);

      throw new TypeError(`"${PROJECT_MANIFEST_FILE}" is invalid:\n${reason}`);
    }

    return new ProjectManifest(manifest.data);
  }

  constructor(
    data: ProjectManifestData
  ) {
    this.editors = [...data.editors];
    this.kinds = [...data.kinds];
    this.kindPackages = [...data.kindPackages];
    this.maxContentBytes = data.maxContentBytes;
  }

  * editorScopes(): IterableIterator<EditorScopes> {
    for (const editor of this.editors) {
      yield {
        name: editor.name,
        kinds: editor.kinds,
        scopes: parseScopes(editor.preferences ?? []),
        shared: parseScopes(editor.sharedPreferences ?? [])
      };
    }
  }
}

function parseScopes(
  descriptors: readonly unknown[]
): PreferenceScope[] {
  return descriptors.flatMap((descriptor) => {
    try {
      return [PreferenceScope.from(descriptor)];
    }
    catch {
      return [];
    }
  });
}
