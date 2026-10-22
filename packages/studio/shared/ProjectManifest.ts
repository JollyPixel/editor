// Import Third-party Dependencies
import * as z from "zod";
import type { LoadedAssetKind } from "@jolly-pixel/asset-server";
import { PreferenceScope } from "@jolly-pixel/editor.host/preferences";

// Import Internal Dependencies
import type { EditorDescriptor } from "./EditorDescriptor.ts";

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
    convertsFrom: z.array(z.string())
  })),
  kindPackages: z.array(z.object({
    name: z.string(),
    kinds: z.array(z.string())
  }))
});

export interface KindPackageDescriptor {
  name: string;
  kinds: readonly string[];
}

export interface EditorScopes {
  name: string;
  kinds: readonly string[];
  scopes: readonly PreferenceScope[];
  shared: readonly PreferenceScope[];
}

export interface ProjectManifestData {
  editors: readonly EditorDescriptor[];
  kinds: readonly LoadedAssetKind[];
  kindPackages: readonly KindPackageDescriptor[];
}

export class ProjectManifest implements ProjectManifestData {
  readonly editors: readonly EditorDescriptor[];
  readonly kinds: readonly LoadedAssetKind[];
  readonly kindPackages: readonly KindPackageDescriptor[];

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

  * preferences(): IterableIterator<PreferenceScope> {
    for (const { scopes, shared } of this.editorScopes()) {
      yield* scopes;
      yield* shared;
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
