// Import Third-party Dependencies
import type { LoadedAssetKind } from "@jolly-pixel/asset-server";
import type { PackageResolver } from "@jolly-pixel/asset-server/node";

// Import Internal Dependencies
import type { EditorDescriptor } from "../../shared/EditorDescriptor.ts";
import type { EditorPreferenceScopes } from "../../shared/PreferenceScopes.ts";
import type { ManifestKind } from "../../shared/ProjectManifest.ts";
import { EditorPackage } from "./EditorPackage.ts";

export class EditorPackages implements Iterable<EditorPackage> {
  #editors: readonly EditorPackage[];

  static async read(
    packageNames: Iterable<string>,
    resolver: PackageResolver
  ): Promise<EditorPackages> {
    return new EditorPackages(
      await Promise.all(Array.from(
        packageNames,
        (packageName) => EditorPackage.read(
          packageName,
          resolver.locate(packageName)
        )
      ))
    );
  }

  constructor(
    editors: Iterable<EditorPackage>
  ) {
    const byName = new Map<string, EditorPackage>();
    for (const editor of editors) {
      const declared = byName.get(editor.name);
      if (declared !== undefined) {
        throw new TypeError(
          `Editor "${editor.name}" is declared by both "${declared.package}" and "${editor.package}".`
        );
      }
      byName.set(editor.name, editor);
    }

    this.#editors = [...byName.values()];
  }

  [Symbol.iterator](): IterableIterator<EditorPackage> {
    return this.#editors.values();
  }

  forKind(
    kind: string
  ): EditorPackage | undefined {
    return this.#editors.find((editor) => editor.kinds.includes(kind));
  }

  framePreviews(
    kinds: Iterable<LoadedAssetKind>
  ): ManifestKind[] {
    const framed = new Set(
      this.#editors.flatMap((editor) => editor.previewKinds)
    );

    return Array.from(kinds, (descriptor) => (
      descriptor.preview === undefined && framed.has(descriptor.kind) ?
        {
          ...descriptor,
          preview: "frame"
        } :
        descriptor
    ));
  }

  editorScopes(): EditorPreferenceScopes[] {
    return this.#editors.map((editor) => {
      return {
        name: editor.name,
        scopes: editor.preferences,
        shared: editor.sharedPreferences
      };
    });
  }

  descriptors(): EditorDescriptor[] {
    return this.#editors.map(
      (editor) => editor.toDescriptor()
    );
  }
}
