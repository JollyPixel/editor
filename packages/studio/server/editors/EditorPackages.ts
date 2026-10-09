// Import Third-party Dependencies
import type { PackageResolver } from "@jolly-pixel/asset-server/node";

// Import Internal Dependencies
import type { EditorDescriptor } from "../../src/editors/EditorDescriptor.ts";
import { EditorPackage } from "./EditorPackage.ts";

export class EditorPackages implements Iterable<EditorPackage> {
  #editors: readonly EditorPackage[];

  static read(
    packageNames: Iterable<string>,
    resolver: PackageResolver
  ): EditorPackages {
    return new EditorPackages(
      Array.from(
        packageNames,
        (packageName) => EditorPackage.read(
          packageName,
          resolver.locate(packageName)
        )
      )
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

  descriptors(): EditorDescriptor[] {
    return this.#editors.map(
      (editor) => editor.toDescriptor()
    );
  }
}
