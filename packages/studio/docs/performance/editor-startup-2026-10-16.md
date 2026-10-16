# Editor start-up, 16 October 2026

How long an editor takes to open from the studio, cold and warm, and what its bundle costs. Measured at `0b0438a8` (baked room environment, lazy gizmo handles, idle delay, voxel-map without canvas MSAA) against `df7d1089`, the code of the [morning report](./editor-performance-2026-10-16.md) with its small fixes. The method and the tools are in [Benchmarking editor opens](./benchmarking.md); this run added the `restart` phase and `--network` throttling to them.

The machine ran in its fast state: a fresh browser's first `requestAdapter` took 322 ms in `probes/firstUse.ts`. All runs are online, in interleaved rounds, medians of 4 or 5 rounds. Variants served from a second `dev:e2e` on port 3014 are described with each run.

## Summary

- voxel-model warm opens are about 100 ms faster since the morning: `reload` 504 → 402 ms, `reopen` 576 → 460 ms. Cold opens gained 19 to 83 ms. voxel-map and pixel-art did not move.
- A warm voxel open spends about 60 ms loading its scripts, 120 to 170 ms in boot steps, and 220 ms waiting on the GPU to compile the first frame's pipelines. That wait is the largest single step of every open.
- A cold open adds about 110 ms before the editor runs its first line: download, background parse and lazy compile of 2.8 to 3.0 MB of eager JavaScript. On an emulated fast 4G link the download alone puts `DOMContentLoaded` at 1.2 s, and a cold open takes 2.1 s (voxel-model) to 3.4 s (voxel-map).
- A returning user (`restart`, browser relaunched on the same profile) gets part of the shader compiles from Chrome's disk cache, 135 to 177 ms instead of 215 to 246 ms. The V8 code cache barely helps: the first boot step starts 10 to 25 ms earlier than cold.
- The voxel editors load 52 KB of brotli for three.js model and KTX2 loaders that no editor uses at boot. Loading them on demand saves 37 to 155 ms on voxel-map cold opens.
- Tested and rejected: V8 compile hints on the eager chunks, and prefetching editor files from the shell on localhost.
- The cold regression the first A/B showed at `0b0438a8` (+67 ms on voxel-map) is an artifact of the attached inspector, see [Measurement artifact](#measurement-artifact).

## What changed since the morning

Five interleaved rounds, `ready` medians in milliseconds ([plan](./editor-startup-2026-10-16.json)):

| Editor | Phase | `df7d1089` | `0b0438a8` |
|---|---|---|---|
| pixel-art | first | 201 | 198 |
| pixel-art | cold | 196 | 193 |
| pixel-art | reload | 102 | 93 |
| pixel-art | reopen | 123 | 121 |
| voxel-map | first | 818 | 850 |
| voxel-map | cold | 651 | 718 |
| voxel-map | reload | 457 | 453 |
| voxel-map | reopen | 476 | 491 |
| voxel-model | first | 783 | 734 |
| voxel-model | cold | 703 | 684 |
| voxel-model | reload | 504 | 402 |
| voxel-model | reopen | 576 | 460 |

Offline gives the same picture: voxel-model `reload` 539 → 438, `reopen` 561 → 476.

The `cold` and `first` rows of `0b0438a8` carry the 50 to 60 ms artifact. With it removed (one-line patch, four rounds, [plan](./editor-startup-2026-10-16-restart.json)), cold voxel-map goes 663 → 647 ms and cold voxel-model 685 → 666 ms. `restart` goes 566 → 598 ms on voxel-map and 631 → 548 ms on voxel-model.

voxel-model's gain is the baked environment: `editor:scene` takes 31 to 35 ms instead of 165 to 190 ms. Part of it comes back in the compile wait, which grows from 143 to 188 ms to 215 to 265 ms on cold opens, since the pipelines no longer compile during the PMREM generation.

`script ms` in the summaries doubled at `0b0438a8` (voxel-map cold 258 → 528). It is counted over the 4 s settle window, and is probably the runtime rendering through the 2 s `idleDelay` after the click. `busy after ready` stayed at 0, so it does not delay the open.

## Where a start goes

Boot steps at `0b0438a8` with the artifact patch, start → end in milliseconds from the double-click ([plan](./editor-startup-2026-10-16-hints.json), control variant):

| Step | voxel-map reload | voxel-map cold | voxel-map restart | voxel-model reload | voxel-model cold | voxel-model restart |
|---|---|---|---|---|---|---|
| first boot step | 62 | 169 | 160 | 57 | 159 | 153 |
| `host.boot:launch` | 67 → 93 | 182 → 211 | 175 → 203 | 69 → 130 | 176 → 251 | 173 → 256 |
| `editor.runtime:renderer` | 70 → 123 | 188 → 230 | 180 → 227 | 80 → 151 | 198 → 271 | 194 → 277 |
| `host.boot:session` | 94 → 127 | 213 → 264 | 205 → 263 | 130 → 140 | 253 → 284 | 258 → 312 |
| `host.boot:mount` | 127 → 185 | 265 → 352 | 264 → 346 | 140 → 182 | 284 → 336 | 312 → 365 |
| `host.boot:compile` | 241 → 462 | 430 → 676 | 411 → 588 | 193 → 420 | 357 → 572 | 385 → 520 |
| `ready` | 462 | 678 | 582 | 428 | 626 | 525 |

pixel-art reaches `ready` at 102 ms warm, 200 ms cold and 193 ms on restart.

- Before the first boot step, a warm open only evaluates modules already compiled in the renderer's memory. A cold or restarted one fetches, parses and compiles them first: 100 to 110 ms more.
- Between `mount` and `ready`, voxel-map's main thread stays busy for about 48 ms before the `ready` step starts.
- `compile` is the wait for the first frame that starts no pipeline compile. It is the same warm and cold, because Playwright's contexts do not keep a shader cache. Only `restart` shortens it.

### Cold: compiling before the first line

A Chrome trace of a cold voxel-map open (`traceOpen.ts`, artifact patch applied) shows where the 110 ms go. Script streaming parses the 14 eager chunks on worker threads (134 ms in total, off the main thread). The main thread then evaluates the modules (52 ms) and compiles 2,319 functions lazily as they first run (57 ms of `V8.CompileCode`).

V8's explicit compile hints, a `//# allFunctionsCalledOnLoad` comment at the top of each eager chunk, move that lazy compile to the streaming threads. Four rounds against the same build without the comment:

| Editor | Phase | Without hints | With hints |
|---|---|---|---|
| voxel-map | cold | 678 | 650 |
| voxel-map | restart | 593 | 617 |
| voxel-model | cold | 626 | 650 |
| voxel-model | restart | 525 | 584 |
| pixel-art | cold | 200 | 182 |

Busy time before `ready` drops by 80 to 100 ms, but the first boot step starts 80 ms later (voxel-map cold 170 → 253 ms): V8 compiles all 3 MB before running anything, including code no boot path reaches. `ready` does not improve.

### Hot: reload, reopen and restart

`reload` and `reopen` reuse the scripts compiled in the renderer's memory and the HTTP cache of the context. They are the best case and do not survive a browser restart.

`restart` relaunches the browser on a persistent profile. The disk HTTP cache serves every file (1 KB transferred) and the Dawn shader cache (5.7 MB in the profile) shortens the compile wait. The V8 code cache does not show: a trace of a restart still parses every chunk on the streaming threads (130 ms) and compiles 3,481 functions lazily (72 ms). With an inspector attached, Chrome may not consume the cache at all, so I checked without one. Five browser launches on one profile, loading the voxel-map page with nothing attached and reading the timings afterwards, start the first boot step at 254 ms against 277 ms in fresh profiles. A returning user saves about 25 ms of script work, far from the 100 ms of a warm reload.

## Bundles

Eager files (the entry and its `modulepreload` links) at `0b0438a8`, from `bundleComposition.ts`:

| Editor | Files | Raw | gzip | brotli |
|---|---|---|---|---|
| voxel-map | 14 | 2994 KB | 846 KB | 691 KB |
| voxel-model | 17 | 2797 KB | 781 KB | 637 KB |
| pixel-art | 8 | 1193 KB | 328 KB | 272 KB |

Both voxel editors also fetch the baked environment at boot (`roomEnvironment.bin`, 688 KB, 77 KB brotli) and await it before building the scene.

Brotli bytes by group, estimated by compressing the bytes each source map assigns to a group:

| Group | voxel-map | voxel-model |
|---|---|---|
| `three.webgpu.js` | 146 KB | 145 KB |
| `three.core.js` | 56 KB | 55 KB |
| three.js loaders and decoders (GLTF, FBX, OBJ, KTX2, zstd, meshopt) | 52 KB | 52 KB |
| `@jolly-pixel/ui` | 58 KB | 59 KB |
| `@jolly-pixel/pixel-draw-renderer` and `editor.pixel-art` | 58 KB | 60 KB |
| `@jolly-pixel/voxel-renderer` | 53 KB | none |
| `@jolly-pixel/three` | 14 KB | 25 KB |
| zod | 22 KB | 22 KB |
| `@jolly-pixel/console` | 15 KB | 15 KB |
| `@jolly-pixel/editor.host` | 14 KB | 13 KB |
| engine, controls, network, runtime | 34 KB | 34 KB |

- The loaders come from `@jolly-pixel/engine`'s `ModelAssetLoader`, which imports the OBJ, MTL, FBX and GLTF loaders and the meshopt decoder statically, and from `Runtime`, which imports `KTX2Loader` even when no `assets.ktx2` option is given. No editor passes one.
- About 370 KB of each voxel editor's raw eager JavaScript has no source mapping. It is the content of template literals: Lit CSS, SVG icons and one base64 font. 70 KB of it is indentation, which brotli mostly absorbs.
- The editors share no file. Each editor is built and served on its own path, so the second editor kind a user opens downloads three.js, ui, host, engine, runtime, network and the pixel-art stack again: about 450 to 500 KB brotli shared in content between voxel-map and voxel-model.
- Each editor bundles both network envelope validators (14 and 32 KB raw, about 5 KB brotli together); a client only parses server envelopes.
- The editor frame bundles the console's UI element, which only standalone editors show. In the studio, the shell owns the console.

### Loading the loaders on demand

The experiment imports the loaders inside the methods that use them and wraps `KTX2Loader` in a loader that imports it on the first `.ktx2` request. Eager brotli drops by 52 KB on voxel-map (708 → 656 KB) and 48 KB on voxel-model (654 → 606 KB). `perf:ab` against the same code without it ([plan](./editor-startup-2026-10-16-loaders.json)), `ready` medians:

| Editor | Phase | Network | Eager loaders | Lazy loaders |
|---|---|---|---|---|
| voxel-map | first | localhost | 815 | 745 |
| voxel-map | cold | localhost | 764 | 727 |
| voxel-map | first | fast 4G | 3828 | 3673 |
| voxel-map | cold | fast 4G | 3498 | 3433 |
| voxel-model | first | localhost | 685 | 674 |
| voxel-model | cold | localhost | 714 | 702 |
| voxel-model | first | fast 4G | 2029 | 2034 |
| voxel-model | cold | fast 4G | 2063 | 2103 |

Four rounds on localhost, three on fast 4G. voxel-map gains 37 to 155 ms. voxel-model's first boot step starts 21 ms earlier on localhost (167 → 146 ms), but its `ready` stays within noise.

### Over a real link

On fast 4G (9 Mbit/s, 165 ms latency), a cold voxel-map open reaches `DOMContentLoaded` at 1264 ms and voxel-model at 1290 ms: the eager download dominates. After that, voxel-map waits on its blockset room: `host.session:dependency` runs from 1290 to 2929 ms for 101 KB of WebSocket data, against about 40 ms on localhost. At 1 MB/s the bytes alone take about 100 ms, so the room open probably makes several round trips one after the other; I did not trace it.

### Prefetching from the shell

The shell fetched every editor's page and eager files once attached, with low priority (`bench:prefetch-editors`). A cold open then transfers 84 KB instead of 778 KB, but on localhost `ready` does not move: voxel-map cold 647 → 663 ms, voxel-model 666 → 646 ms, pixel-art 194 → 201 ms. Compile, not transfer, is the local cost. It was not measured on fast 4G: the harness opens the editor 500 ms after the asset list shows, before a throttled prefetch can finish.

## Measurement artifact

At `0b0438a8`, the voxel editors call `BakedRoomEnvironment.load()` in `createRuntime`, so `fetch` runs synchronously during module evaluation. Playwright keeps the CDP Network domain enabled, and Chrome then records the JavaScript stack of every request for its initiator. That stack holds the top-level functions of the chunks being evaluated, which V8 has not parsed for source positions yet. In a cold voxel-map trace, `V8.CollectSourcePositions` runs 7 times for 61 ms inside `v8.evaluateModule`, and evaluation goes from 55 to 119 ms.

Deferring the call by one microtask (`queueMicrotask(() => void BakedRoomEnvironment.load())`) removes it: the first boot step moves from 214 to 168 ms. Loaded with no inspector attached, the original and the deferred builds start the first boot step at 276 and 277 ms, so users do not pay it. Any other synchronous request during module evaluation inflates cold numbers in this harness the same way.

## Experiments

[`editor-startup-2026-10-16.patch`](./editor-startup-2026-10-16.patch) holds the code of every variant: the microtask deferral in both voxel editors, the shell prefetch behind `bench:prefetch-editors`, and the lazy loaders in `@jolly-pixel/engine` and `@jolly-pixel/runtime`. It applies to `0b0438a8`. The compile hints were a post-build step that prepended the comment to each eager chunk and rewrote its `.br` and `.gz` copies.

What port 3014 served in each plan:

- [`editor-startup-2026-10-16.json`](./editor-startup-2026-10-16.json): `df7d1089`.
- [`editor-startup-2026-10-16-restart.json`](./editor-startup-2026-10-16-restart.json): `df7d1089`; port 3004 served `0b0438a8` with the deferral and the prefetch flag.
- [`editor-startup-2026-10-16-hints.json`](./editor-startup-2026-10-16-hints.json): `0b0438a8` with the deferral and compile hints; port 3004 the deferral alone.
- [`editor-startup-2026-10-16-loaders.json`](./editor-startup-2026-10-16-loaders.json): `0b0438a8` with the deferral and lazy loaders; port 3004 the deferral alone.

## Recommendations

In order of gain per effort, on this machine.

| # | Change | Where | Gain | Effort |
|---|---|---|---|---|
| 1 | Import the model loaders, the meshopt decoder and `KTX2Loader` on first use | `@jolly-pixel/engine` `assets/model.ts`, `@jolly-pixel/runtime` `Runtime.ts` | −52 KB brotli per voxel editor, −37 to −155 ms on voxel-map cold opens | low |
| 2 | Start `BakedRoomEnvironment.load()` after module evaluation | voxel-map and voxel-model `createRuntime` | none for users; keeps 50 to 60 ms of inspector cost out of every cold measurement | trivial |
| 3 | Trace the blockset room open on a slow link and cut its sequential round trips | `@jolly-pixel/editor.host` session, asset-server dependency rooms | up to 1.5 s of a voxel-map cold open on fast 4G | medium |
| 4 | Build the shared packages once and serve them from one path to every editor | editor builds, studio `EditorPages` | the second editor kind's cold open skips about 450 KB brotli, about 0.4 s on fast 4G (estimated) | high |
| 5 | Prefetch the editors' eager files from the idle shell | studio `src/index.ts` | none on localhost; up to the eager download (1.2 s on fast 4G) when the user idles long enough, not measured | low |
| 6 | Move client code paths to `zod/mini` | host, network, asset packages | about −20 KB brotli per editor | medium |

The compile wait (215 to 246 ms) is the largest step left, and only fewer distinct pipelines shorten it on a first visit. Ending the tab spinner before it would shorten the perceived open by the same amount, at the cost of showing the viewport before every object draws.

Not worth doing now:

- Compile hints on the eager chunks: measured, no gain on `ready`.
- Lazy console UI in editor frames, the unused envelope validator, minifying Lit templates: 5 to 15 KB brotli each.

## Limits

- One machine: Intel Core Ultra 9 285HX laptop, integrated Xe-LPG GPU, Chromium 156 on Direct3D 12, studio on localhost. Fast 4G is CDP emulation: it adds latency per request in the renderer and does not model packet loss.
- `restart` runs with Playwright attached, which may keep Chrome from consuming its code cache; the uninstrumented check covers voxel-map only, five launches.
- The seed project is small, as in the morning report.
- The variants on port 3014 changed between runs, so compare rows within one plan only.
- The prefetch was measured on localhost only.
