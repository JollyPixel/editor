# Asset workspace migration

## Status

Implementation plan.

The repository currently keeps JollyPixel-specific asset persistence, network
synchronization, and an engine `ActorComponent` inside the two renderer
packages. This gives otherwise reusable renderers production dependencies on
`@jolly-pixel/asset-server`, `@jolly-pixel/event-store`,
`@jolly-pixel/network`, and, for the voxel renderer, `@jolly-pixel/engine`.

Move those integrations into two public workspaces:

- `packages/assets/voxel-map`
- `packages/assets/pixel-art`

The directory names are fixed by this plan. Confirm the npm package names
before creating their manifests. The suggested names are:

- `@jolly-pixel/asset.voxel-map`
- `@jolly-pixel/asset.pixel-art`

## Dependency direction

The new asset workspaces depend on the renderer packages. A renderer must not
depend on an asset workspace, directly or through a compatibility export.

```text
editors and applications
    |
    +-- assets/voxel-map ---> voxel-renderer
    |       +-- asset-server
    |       +-- event-store
    |       +-- network
    |
    +-- assets/pixel-art --> pixel-draw-renderer
            +-- asset-server
            +-- event-store
            +-- network
```

Do not leave forwarding exports under the old renderer `/asset` or `/network`
subpaths. Such exports would retain the dependency this migration removes.
Their removal is a breaking API change and needs major changesets for both
renderers.

## Package ownership

### `@jolly-pixel/voxel.renderer`

Keep the voxel domain and rendering implementation in this package:

- `VoxelEngine`, `VoxelWorld`, layers, blocks, and hooks
- document encoding, decoding, parsing, and validation
- tileset definitions, loading, and block generation
- chunk meshing, materials, visibility, debugging, and collision ports
- generic Tiled types, `TileSet`, and `TiledConverter`
- Rapier integration
- domain command replay, including `VoxelWorld.applyRemoteCommand()` and
  `world/dispatchCommand.ts`

Remove the following:

- `src/asset/**`
- `src/network/**`
- `src/VoxelRenderer.ts`
- `src/plugins/tiled/loader.ts`
- the `/asset` and `/network` package exports
- production dependencies on `@jolly-pixel/asset`,
  `@jolly-pixel/asset-server`, `@jolly-pixel/event-store`,
  `@jolly-pixel/network`, and `@jolly-pixel/engine`

`TiledMapAssetLoader` moves because it implements the `@jolly-pixel/asset`
loader contract and imports engine utilities. `TiledConverter` stays because
conversion between a Tiled document and the renderer's voxel document is a
renderer concern and has no JollyPixel service dependency.

### `@jolly-pixel/pixel-draw.renderer`

Keep the local pixel editing domain in this package:

- `PixelDocument`, `PixelBuffer`, and `PixelArtCanvas`
- drawing tools, history, clipboard, selection, and UV mapping
- pixel-art document serialization and validation
- buffer hooks and the generic APIs used to apply remote changes
- canvas and presence rendering primitives which do not import the network
  package

Move or remove:

- `src/asset/**`
- `src/network/**`
- network exports from `src/index.ts`
- the `/asset` and `/network` package exports
- asset-server and event-store peer dependencies
- the production dependency and TypeScript reference for
  `@jolly-pixel/network`
- stale engine and runtime TypeScript project references

Keep `js-base64`. It is still used by serialization, history, clipboard, and
the edit pipeline after the network code moves.

### Voxel-map asset workspace

Move these APIs to `packages/assets/voxel-map`:

- `voxelMapAssetHandler`
- `VoxelMapState`
- voxel network command and server-message types
- protocol schemas and validators
- `VoxelCommandArbiter`
- `VoxelSyncClient` and `VoxelSyncServer`
- `applyBlockCommand`
- `TiledMapAssetLoader`

The moved code must import voxel types and behavior through the public
`@jolly-pixel/voxel.renderer` API. It must not import renderer source files or
copy renderer-owned types.

Use separate public entry points for browser and server code. A suitable
initial export map is:

- package root: `voxelMapAssetHandler` and `VoxelMapState`
- `./network/client.ts`: client types and `VoxelSyncClient`
- `./network/server.ts`: server, schemas, validators, and arbiter
- `./tiled.ts`: `TiledMapAssetLoader`

### Pixel-art asset workspace

Move these APIs to `packages/assets/pixel-art`:

- `pixelArtAssetHandler`
- `PixelArtState`
- pixel network command and server-message types
- command schema, applier, validator, and arbiter
- `PixelSyncClient` and `PixelSyncServer`
- `PixelCursorSync`
- `PeerGhostLeaser` and `PeerPresenceGhostSync`
- `PixelStrokeGhostSync`, `SelectionGhostSync`, and `UVGhostSync`

The moved code imports the pixel buffer, canvas, hooks, UV types, and document
codecs from `@jolly-pixel/pixel-draw.renderer`.

Expose:

- package root: `pixelArtAssetHandler` and `PixelArtState`
- `./network/client.ts`: client synchronization and presence APIs
- `./network/server.ts`: server, schemas, validation, arbitration, and command
  application

The client entry point must not load `worker_threads`, asset-server, or
event-store modules. Avoid a shared barrel that imports both client and server
implementations.

## Migration steps

### 1. Create the workspaces

Add `package.json`, `tsconfig.json`, `test/tsconfig.json`, `README.md`, and the
required source entry points to each new directory. Follow the scripts and
publishing metadata used by the repository's other public packages.

Add both paths to the root `workspaces` array and both projects to the root
TypeScript references. Add `#src/*` imports for tests. Run `npm install` after
the manifests exist so `package-lock.json` records the new workspaces and
dependency edges.

Use normal dependencies for integrations that the new packages always need.
Do not reproduce the optional asset-server and event-store peer dependency
arrangement from the renderers.

### 2. Extract pixel-art persistence and collaboration

Move `packages/pixel-draw-renderer/src/asset/**` and
`packages/pixel-draw-renderer/src/network/**` into the pixel-art asset
workspace. Preserve behavior during the move; API redesign can happen in a
later change.

Move the matching tests:

- `test/asset/**`
- `test/network/**`
- the network collision section of `test/PixelArtCanvas.history.spec.ts`

Move `bench/network.bench.ts` if the benchmark is still maintained. Keep
`test/PixelArtCanvas.network.spec.ts` in the renderer. Despite its filename,
it tests renderer hooks, snapshots, local restore behavior, and remote command
application without using `@jolly-pixel/network`.

Add public-entry tests for the new client and server exports. The existing
`PublicExports.spec.ts` assertions belong in the new package.

Once the moved package passes its tests, remove the old source directories,
manifest exports, dependencies, and root re-exports from the renderer.

### 3. Extract voxel-map persistence and collaboration

Move `packages/voxel-renderer/src/asset/**` and
`packages/voxel-renderer/src/network/**` into the voxel-map asset workspace.
Move `src/plugins/tiled/loader.ts` as the implementation of the new
`./tiled.ts` entry point, then remove its export from the renderer's Tiled
barrel.

Move the matching tests and helpers:

- `test/asset/**`
- `test/network/**`
- `test/plugins/tiled/loader.spec.ts`
- `test/helpers/networkCommands.ts`

Keep `test/world/commandRoundTrip.spec.ts` in the renderer. It exercises
generic hook replay and convergence between two `VoxelWorld` instances.

After the moved tests pass, delete the old source directories and remove their
package exports and dependencies.

### 4. Remove the public ECS wrapper

`VoxelRenderer` currently performs five integration tasks:

1. creates a `VoxelEngine` with the actor world's logger;
2. attaches `engine.root` during `awake()`;
3. samples an optional focus object's world position;
4. calls `engine.tick()` during component updates;
5. removes the root and disposes the engine when destroyed.

Recreate that behavior at the application boundary.

Add an example-local component under
`packages/voxel-renderer/examples/scripts/components` and update
`VoxelMap.ts`, `demo-noise-world.ts`, and `demo-physics.ts` to use it. The
component is example support code, not a renderer export.

Add an editor-local component to `packages/editors/voxel-map`, preferably
named `VoxelEngineComponent`, and update `EditorScene` to use it. Add a focused
lifecycle test covering root attachment, ticking, focus conversion, logger
inheritance, and disposal.

The examples may keep engine and runtime development dependencies. Production
renderer source and production dependencies may not use them.

Update the engine's component-name documentation and the
`StrictComponentEnum` entry for `"VoxelRenderer"` only if the local editor and
example components no longer use that name.

### 5. Update editor and build-time consumers

In `packages/editors/pixel-art`:

- import `PixelSyncServer` from the new server entry point in `vite.config.ts`;
- import `PixelSyncClient`, ghost synchronization classes, and network types
  from the new client entry point in `DemoSync.ts`;
- add the new package dependency and TypeScript project reference.

In `packages/editors/voxel-map`:

- replace every `@jolly-pixel/voxel.renderer/network/client.ts` import with the
  voxel-map asset client entry point;
- import pixel network types and synchronization classes from the pixel-art
  asset client entry point;
- update `EditorSession`, `EditorSidebar`, `EditorScene`, collaboration
  components, texture collaboration classes, and their tests;
- import `pixelArtAssetHandler` from the pixel-art asset package in
  `vite.config.ts`;
- import `voxelMapAssetHandler` and `VoxelMapState` from the voxel-map asset
  package in `vite.config.ts`;
- continue to import document codecs, `blocksFromTileset`, tileset types, and
  tileset resolution from their renderer packages;
- update `vite/tilesetSeed.ts` to import tileset APIs from the voxel renderer's
  root entry point;
- add both asset workspaces to dependencies and TypeScript references.

No current voxel-model editor import uses the asset or network subpaths. Its
renderer imports should remain unchanged.

### 6. Move and update documentation

Move pixel asset and network documentation out of
`packages/pixel-draw-renderer/docs` and into the pixel-art asset workspace.
Move voxel asset-server and network documentation into the voxel-map asset
workspace. Move the `TiledMapAssetLoader` API page with its implementation.

Rewrite the renderer documentation to match the remaining APIs:

- describe direct `VoxelEngine` construction and lifecycle management;
- remove the public `VoxelRenderer` API page and update links to it;
- remove network and persistence setup from both renderer READMEs;
- keep the generic Tiled conversion guide in the voxel renderer and link to
  the asset package for catalog loading;
- add browser and server usage examples to each new package README.

Update `packages/asset-server/docs/AssetKinds.md` to import both handlers from
their new packages. Add both asset packages to the root README package list.

Search source, tests, examples, and Markdown for the removed renderer
`/asset` and `/network` imports before considering the documentation work
complete.

### 7. Add release metadata

Add major changesets for `@jolly-pixel/voxel.renderer` and
`@jolly-pixel/pixel-draw.renderer`. Their public subpaths and exports are being
removed.

Include both new public packages in the repository's initial-publication
workflow. Do not add changesets for the private pixel-art and voxel-map editor
workspaces. Keep every changeset summary to two or three lines.

## Validation

Run the four library test suites first, followed by both affected editors:

```sh
npm test -w @jolly-pixel/pixel-draw.renderer
npm test -w @jolly-pixel/voxel.renderer
npm test -w @jolly-pixel/asset.pixel-art
npm test -w @jolly-pixel/asset.voxel-map
npm test -w @jolly-pixel/editor.pixel-art
npm test -w @jolly-pixel/editor.voxel-map
```

Use the final npm package names if they differ from the suggested names in
this document.

Run the repository checks after the focused suites pass:

```sh
npm run typecheck
npm run lint
npm run build
```

The regular voxel-renderer build runs TypeScript only. Build its Vite examples
separately so their local ECS component and Tiled loader imports are checked.
Run the pixel-art Playwright suite because its Vite server setup changes.
Build the voxel-map editor to exercise asset workspace initialization and its
server-only handler imports.

Before release:

- run `npm pack --dry-run` for both renderers and both asset packages;
- import each client entry point in a browser build;
- import each server entry point in Node;
- verify that a client import does not load `worker_threads`, asset-server, or
  event-store;
- scan the renderer production source for forbidden JollyPixel imports.

## Completion criteria

The migration is finished when all of the following are true:

- neither renderer exports an `/asset` or `/network` subpath;
- neither renderer declares asset-server or event-store peer dependencies;
- `packages/voxel-renderer/src` imports no `@jolly-pixel/asset*`,
  `@jolly-pixel/network`, or `@jolly-pixel/engine` module;
- `packages/pixel-draw-renderer/src` imports no asset-server, event-store, or
  network module;
- `VoxelRenderer` is no longer part of the voxel renderer's public API;
- asset handlers, sync clients and servers, schemas, arbiters, and presence
  synchronization live in the new workspaces;
- editors use the asset workspaces for persistence and collaboration and the
  renderer packages for local domain and rendering APIs;
- browser entry points do not pull server-only modules into their dependency
  graph;
- moved tests run under their new owning workspaces;
- no current source file or documentation page imports a removed subpath;
- focused tests, editor tests, typecheck, lint, builds, example builds, and the
  affected browser tests pass.
