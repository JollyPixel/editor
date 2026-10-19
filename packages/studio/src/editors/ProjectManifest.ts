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
    preferences: z.array(z.unknown()).default([])
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
  }))
});

export interface ProjectManifestData {
  editors: readonly EditorDescriptor[];
  kinds: readonly LoadedAssetKind[];
}

export class ProjectManifest implements ProjectManifestData {
  readonly editors: readonly EditorDescriptor[];
  readonly kinds: readonly LoadedAssetKind[];

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
  }

  * preferences(): IterableIterator<PreferenceScope> {
    for (const editor of this.editors) {
      for (const descriptor of editor.preferences ?? []) {
        const scope = parseScope(descriptor);
        if (scope !== null) {
          yield scope;
        }
      }
    }
  }
}

function parseScope(
  descriptor: unknown
): PreferenceScope | null {
  try {
    return PreferenceScope.from(descriptor);
  }
  catch {
    return null;
  }
}
