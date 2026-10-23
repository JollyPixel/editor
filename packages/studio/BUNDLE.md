# Bundle size, 17 October 2026

What the studio shell and the three editor pages make the browser download before they run, where those bytes come from, and what could shrink them. Measured at `334fb9b3` with fresh `vite build`s of each page. Each opportunity is written so it can be picked up on its own.

## Summary

- Every page is already minified, three.js included, and [`serveBuild`](./server/serveBuild.ts) serves precompressed brotli with an immutable cache on hashed assets. The weight comes from what the pages contain and from how they are built.
- three.js is about 220 KB of brotli in each voxel editor, a third of the page. Our copy is close to the cost of `WebGPURenderer` alone, so tree-shaking it harder saves little.
- The offline back-end chunk ships the whole ata-validator schema compiler: 438 KB minified, 95 KB brotli. The `1.53.0` bump (`e91817e4`) grew it by 30 KB of brotli. Item 1 replaces it with zod in the browser.
- Smaller items: lazy-loading what the first screen does not show, per-consumer ui registration, picomatch and classic zod in the browser, and `emitDecoratorMetadata`.

## Where the bytes are

Eager means the entry chunk and everything it imports statically, which is what `index.html` preloads. Brotli is quality 11.

| Page | Eager minified | Eager brotli |
|---|---|---|
| studio shell | 920 KB | 203 KB |
| voxel-map | 2748 KB | 626 KB |
| voxel-model | 2553 KB | 576 KB |
| pixel-art | 1135 KB | 258 KB |

Largest packages in the eager code, in KB of brotli. A package's share is its chunk's size split by the rendered length of its modules, so treat these as estimates:

| Package | shell | voxel-map | voxel-model | pixel-art |
|---|---|---|---|---|
| three | | 223 | 219 | |
| `@jolly-pixel/ui` | 87 | 100 | 101 | 87 |
| editor's own code | 22 | 58 | 37 | 26 |
| `@jolly-pixel/voxel.renderer` | | 51 | | |
| `@jolly-pixel/pixel-draw.renderer` | | 37 | 38 | 38 |
| `@jolly-pixel/editor.pixel-art` | | 22 | 23 | |
| `@jolly-pixel/console` | 18 | 15 | 15 | 17 |
| `@jolly-pixel/network` | 14 | 13 | 14 | 17 |
| zod | 23 (classic) | 6 (mini) | 6 (mini) | 8 (mini) |
| picomatch | 7 | 8 | 8 | 7 |

The lazy chunks that matter are the offline back-end (ata-validator chunk 95 KB brotli, `OfflineServer` 34 KB), the three.js model loaders (GLTF, FBX, OBJ, KTX2, meshopt), `basis_transcoder.wasm` (199 KB brotli, only fetched for a KTX2 texture) and `roomEnvironment.bin` (672 KB raw, 77 KB brotli, awaited during voxel-map boot).

No dependency is bundled twice in different versions: one each of three `0.186.1`, lit `3.3.3`, zod `4.6.5`.

## Opportunities

Ranked by expected gain. Estimates are eager brotli unless stated.

### 1. Lazy-load what the first screen does not show

Code that every page evaluates at boot but nobody sees until a click, in KB of rendered length:

| Group | shell | voxel-map | voxel-model | pixel-art |
|---|---|---|---|---|
| dialogs | 35 | 59 | 37 | 26 |
| console element (`@jolly-pixel/console/element`) | 44 | 44 | 44 | 44 |
| tours and `@jolly-pixel/lantern` | | 29 | 25 | 25 |
| template preview | 8 | 39 | | |
| ui stats components | 12 | 21 | 21 | 12 |

That is about 190 KB rendered in voxel-map, roughly 25 to 30 KB of brotli; 15 to 20 KB in the other pages. The console is the cleanest case: [`mountConsole`](../editors/host/src/console/mountConsole.ts) imports the element eagerly, while `CommandConsole` and the namespaces are the part the editors need at boot. `MetricsPanel` is already lazy, but the stats components still come in through the ui barrel (see 3).

The pixel-art editor inside voxel-map is not a candidate: the texture editor is placed in the Blocks pane, which is the pane shown at boot ([`EditorPanels`](../editors/voxel-map/src/shell/EditorPanels.ts)).

### 2. Register ui components per consumer

Every page bundles 251 to 266 of ui's 278 `dist` modules, because the root barrel re-exports every component and each component registers itself when its module runs. Components a page never names by tag:

- shell: 25 of 54 components, 148 KB rendered (about 20 KB brotli), led by `jolly-floating`, `jolly-tool-button`, `jolly-slider`, `jolly-folder`, `jolly-stats`, `jolly-loading`.
- voxel-map: 13 of 54, 63 KB rendered (about 9 KB brotli).

Adding a `sideEffects` list to ui alone gains nothing: marking every non-registering module side-effect free, with the barrels kept, moved voxel-map from 626 to 624 KB and the shell not at all. The saving needs consumers to import the components they use, for example per-component or per-group registration entry points. That is a public API change across every consumer, and a bare barrel import missing from `sideEffects` silently drops registrations, so it needs a bundle guard that checks the registered tags.

## Measured and dropped

- **Minifying Lit `css` and `html` template literals.** Collapsing indentation and comments inside template literals removes 64 KB raw from voxel-map but only about 3 KB of brotli.
- **Tree-shaking three further.** A build of only `WebGPURenderer`, `Mesh`, `BoxGeometry`, `MeshStandardNodeMaterial` and `Scene` from `three/webgpu` is 763 KB minified / 166 KB brotli. Ours is 986 / 223 KB, and most of the difference is TSL nodes the editors use. Small eager extras: `BloomNode`, `ViewHelper`, `FontLoader`, `LineSegments2`.
- **Lazy pixel-art in voxel-map.** Shown at boot, see 2.

## Method

The numbers come from throwaway scripts that were not committed. To rebuild them:

- **Module report.** Run `vite.build()` with the page's own `vite.config.ts` and an output directory outside the repo, and add a plugin whose `generateBundle` hook records, for each chunk, `fileName`, `isEntry`, `imports`, the code length, its brotli size and `modules[id].renderedLength`. Write that to JSON.
- **Eager set.** Start from the entry chunks and follow `imports` (static only).
- **Per-package brotli.** Split each eager chunk's brotli size across its modules by rendered length, then group module ids by `node_modules` package or `packages/<workspace>`.
- **Floors.** Build a virtual entry such as `import { WebGPURenderer } from "three/webgpu"; console.log(WebGPURenderer)` with `configFile: false` from an editor's directory so it resolves the same dependencies.

Two limits: the `network` and `asset-server` `dist` folders were not rebuilt after `9bcc044e` and `334fb9b3`, so their sizes may be slightly off, and rendered length is measured before minification, so packages with long CSS strings or comments are over-weighted in the per-package split. Tree-shaking checks should read chunk `moduleIds` from a vite build, not an esbuild metafile, as the existing bundle specs do ([`Runtime.bundle.spec.ts`](../runtime/test/Runtime.bundle.spec.ts)).
