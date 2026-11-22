// Import Node.js Dependencies
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

export interface DeclaredComponentDefinition {
  readonly type: string;
  readonly assets?: Readonly<Record<string, {
    readonly kind: { readonly value: string; };
  }>>;
}

export interface DeclaredComponentPackage {
  readonly definitions: readonly DeclaredComponentDefinition[];
}

interface SceneComponentManifestEntry {
  assets?: Record<string, string>;
}

export function assertDeclaresSceneComponents(
  packageDir: string,
  components: DeclaredComponentPackage
): void {
  const manifest = fs.readFileSync(path.join(packageDir, "package.json"), "utf8");
  const { jollypixel } = JSON.parse(manifest);

  assert.deepEqual(
    sceneComponentDeclarations(components),
    jollypixel.sceneComponents
  );
}

function sceneComponentDeclarations(
  components: DeclaredComponentPackage
): Record<string, SceneComponentManifestEntry> {
  return Object.fromEntries(components.definitions.map((definition) => {
    const slots = Object.entries(definition.assets ?? {});
    const entry: SceneComponentManifestEntry = slots.length === 0 ?
      {} :
      {
        assets: Object.fromEntries(
          slots.map(([slot, type]) => [slot, type.kind.value])
        )
      };

    return [definition.type, entry];
  }));
}
