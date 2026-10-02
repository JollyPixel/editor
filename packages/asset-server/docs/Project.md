# Project file

A project lists the [kind packages](./AssetKinds.md#kind-packages) it uses in
`.jollypixel/project.json`, beside the other files asset-server keeps there.
Import the classes below from `@jolly-pixel/asset-server/node`, and
`PROJECT_FILE_PATH` from the package root.

```json
{
  "version": 1,
  "kinds": {
    "@jolly-pixel/asset.pixel-art": { "defaultSize": { "x": 64, "y": 64 } },
    "@jolly-pixel/asset.voxel-map": {}
  }
}
```

`kinds` maps each package name to the options its `ASSET_KINDS.handlers`
receives. Other top-level sections belong to the host: asset-server keeps them
in `document` without checking them.

```ts
const file = await ProjectFile.read(root);
const kinds = await ProjectKinds.load(file);

await createAssetWorkspace({
  root,
  handlers: kinds.handlers()
});
```

## ProjectFile

```ts
type ProjectFileData = {
  version: 1;
  kinds?: Record<string, Record<string, unknown>>;
} & Readonly<Record<string, unknown>>;

class ProjectFile {
  static read(root: string): Promise<ProjectFile>;
  static readOrCreate(
    root: string,
    data: ProjectFileData
  ): Promise<ProjectFile>;
  static parse(root: string, rawData: string): ProjectFile;

  constructor(root: string, data: ProjectFileData);

  readonly root: string;
  readonly path: string;
  readonly document: Readonly<Record<string, unknown>>;
  readonly kinds: ReadonlyMap<string, Readonly<Record<string, unknown>>>;
}
```

`read` treats a missing file as `{ "version": 1 }`, a project without kinds.
`readOrCreate` writes `data` when the file is missing, never over an existing
one, then reads it.
Invalid JSON, a `version` other than `1`, or a `kinds` entry that is not an
object throws a `TypeError` naming the file. `kinds` keeps the file's order.

## ProjectKinds

```ts
type PackageLoader = (packageName: string) => Promise<unknown>;

interface ProjectKindsLoadOptions {
  load?: PackageLoader;
}

class ProjectKinds {
  static load(
    file: ProjectFile,
    options?: ProjectKindsLoadOptions
  ): Promise<ProjectKinds>;

  constructor(packages: Iterable<KindPackage>);

  readonly packages: readonly KindPackage[];

  handlers(): AssetKindHandler[];
  descriptors(): AssetKindDescriptor[];
}
```

`load` imports the packages of `file.kinds` concurrently and keeps their
order. By default it resolves each package from the project root, so
`node_modules` folders above the root apply. Pass `load` to resolve from
somewhere else.

A kind claimed by two packages throws a `TypeError` naming both, and so does a
package claiming `binary` or `texture`, which asset-server ships itself.
`handlers()` concatenates the packages in order and ends with
`textureAssetKind()`; `descriptors()` concatenates the packages only.

## KindPackage

```ts
class KindPackage {
  static load(
    name: string,
    options: Readonly<Record<string, unknown>>,
    load: PackageLoader
  ): Promise<KindPackage>;

  readonly name: string;
  readonly options: Readonly<Record<string, unknown>>;
  readonly descriptors: readonly AssetKindDescriptor[];
  readonly handlers: readonly AssetKindHandler[];
}
```

`load` throws a `TypeError` naming the package when it cannot be imported,
when it has no `ASSET_KINDS` export (`KINDS_EXPORT`), when its descriptors are
malformed, when `options` fail its `optionsSchema`, or when a descriptor names
a kind its handlers do not cover.
