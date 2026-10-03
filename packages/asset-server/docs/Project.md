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

`kinds` maps each package to the options its `ASSET_KINDS.handlers`
receives. A key is a package name, or a folder holding a `package.json` when
it starts with `./` or `../`, relative to the project root. Other top-level
sections belong to the host: asset-server keeps them in `document` without
checking them.

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

interface ProjectFileOpenOptions {
  inMemory?: boolean;
}

class ProjectFile {
  static read(root: string): Promise<ProjectFile>;
  static readOrCreate(
    root: string,
    data: ProjectFileData
  ): Promise<ProjectFile>;
  static open(
    root: string,
    data: ProjectFileData,
    options?: ProjectFileOpenOptions
  ): Promise<ProjectFile>;
  static parse(root: string, rawData: string): ProjectFile;

  constructor(root: string, data: ProjectFileData);

  readonly root: string;
  readonly path: string;
  readonly document: Readonly<Record<string, unknown>>;
  readonly kinds: ReadonlyMap<string, Readonly<Record<string, unknown>>>;

  isStale(): Promise<boolean>;
}
```

`read` treats a missing file as `{ "version": 1 }`, a project without kinds.
`readOrCreate` writes `data` when the file is missing, never over an existing
one, then reads it. `open` calls `readOrCreate`, or with `inMemory` keeps
`data` without reading or writing anything, for builds and test runs that
must not depend on the folder.
Invalid JSON, a `version` other than `1`, or a `kinds` entry that is not an
object throws a `TypeError` naming the file. `kinds` keeps the file's order.

`isStale` resolves `true` when the file on disk is missing, invalid, or holds
another document than `document`. Formatting alone does not make it stale.

## ProjectKinds

```ts
type PackageLoader = (packageName: string) => Promise<unknown>;

interface ProjectKindsLoadOptions {
  resolver?: PackageResolver;
  load?: PackageLoader;
}

class ProjectKinds {
  static load(
    file: ProjectFile,
    options?: ProjectKindsLoadOptions
  ): Promise<ProjectKinds>;

  constructor(
    packages: Iterable<KindPackage>,
    resolver: PackageResolver
  );

  readonly packages: readonly KindPackage[];
  readonly resolver: PackageResolver;

  handlers(): AssetKindHandler[];
  descriptors(): AssetKindDescriptor[];
}
```

`load` imports the packages of `file.kinds` concurrently and keeps their
order. It imports the file `resolver` resolves, by default a
`PackageResolver` on `file.root`, and keeps that resolver so browser code
finds the same packages. Pass `load` to import packages another way.

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

## PackageResolver

```ts
interface PackageResolverOptions {
  fallbacks?: Iterable<string>;
}

class PackageResolver {
  static isLocal(specifier: string): boolean;

  constructor(root: string, options?: PackageResolverOptions);

  readonly root: string;
  readonly directories: readonly string[];

  locate(specifier: string): string;
  resolve(specifier: string): string;
  importersOf(specifier: string): string[];
}
```

A package name resolves from `root`, so `node_modules` folders above it apply,
then from each of `fallbacks` in order: a host lists its own folder there so a
project without `node_modules` still finds the packages the host installs. The
first directory holding the package wins. `directories` is `root` followed by
the fallbacks, all absolute.

A specifier starting with `./` or `../` (`isLocal`) is a folder relative to
`root` and never falls back. It needs a `package.json`; its entry is the
`exports` of that file, or its `main` without `exports`.

`locate` returns the real path of the package's folder. `resolve` returns the
file Node imports, resolved with the `require` conditions. Both throw a
`TypeError` naming a specifier they cannot find. `importersOf` returns the
files, one per directory searched, that a bundler resolves `specifier` from;
they need not exist.

## createProjectKindsPlugin

```ts
const PROJECT_HANDLERS_MODULE_ID = "virtual:jolly-pixel/handlers";

function createProjectKindsPlugin(kinds: ProjectKinds): Plugin;
function projectHandlersModule(kinds: ProjectKinds): string;
```

A Vite plugin serving `PROJECT_HANDLERS_MODULE_ID` to browser code, for an
offline workspace that runs the back-end in the page. Its default export
returns the same handlers as `kinds.handlers()`, each package called with the
options of the project file, then `textureAssetKind()`. It applies to both the
dev server and builds.

The module imports each package by its specifier, which Vite resolves from
`kinds.resolver.importersOf` with browser conditions, so a project outside
the Vite root brings its own packages. The module also imports
`@jolly-pixel/asset-server`, which the Vite root must resolve.
`projectHandlersModule` returns the module source.

```ts
const kinds = await ProjectKinds.load(await ProjectFile.read(root));

export default defineConfig({
  plugins: [
    createProjectKindsPlugin(kinds)
  ]
});
```

```ts
declare module "virtual:jolly-pixel/handlers" {
  export default function createHandlers(): AssetKindHandler[];
}
```

## createProjectFileWatchPlugin

```ts
function createProjectFileWatchPlugin(file: ProjectFile): Plugin;
```

A dev-server plugin that restarts the server when `file.isStale()`, so editing
the project file reloads its kinds. The host's config opens the file again on
restart. Leave it out when the file is opened `inMemory`.

```ts
export default defineConfig(async({ command }) => {
  const inMemory = command === "build";
  const file = await ProjectFile.open(root, data, { inMemory });

  return {
    plugins: [
      createProjectKindsPlugin(await ProjectKinds.load(file)),
      inMemory ? null : createProjectFileWatchPlugin(file)
    ]
  };
});
```
