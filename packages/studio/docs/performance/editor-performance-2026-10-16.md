# Editor performance, 16 October 2026

Where the editors spend their time and memory, measured at `86ad0bda` after the October fixes: async pipeline compiles (`02b3191a`) and the Block Library on the viewport's WebGPU renderer (`86ad0bda`). It covers opening an editor from the studio, an editor sitting open, and the server behind them. The method and the tools are described in [Benchmarking editor opens](./benchmarking.md).

Five fixes landed the same day, and the findings they close are no longer listed here:
- The Block Library spins the selected cell only while the pointer is over the library.
- Base64 goes through `Uint8Array.fromBase64`, `Buffer` or `atob` instead of `js-base64`.
- `PreviewPixels` copies readback rows with `TypedArray.set` and encodes sRGB through a table.
- Network snapshots are encoded as PNG without row filters, 70 KB instead of 124 KB for the seed blockset.
- With `renderOnDemand`, the runtime sleeps 2 s after the last input (`GameLoop` `idleDelay`) instead of rendering every frame while the pointer is over the canvas. Over 5 s with a resting pointer, voxel-model goes from 152 to 53 ms/s of main thread and voxel-map from 190 to 65. With the pointer nudged over the panels every 400 ms, the loop no longer sleeps and wakes 11 times. It renders the whole time, at about 90 ms/s more.

The machine ran in its fast state for the whole session: a fresh browser's first `requestAdapter` took 352 ms in `probes/firstUse.ts`, against 586 to 1232 ms in the earlier October runs. Absolute times are comparable within this report only.

## Summary

- pixel-art opens in 110 to 220 ms. Nothing to fix.
- voxel-map and voxel-model reach `ready` in 540 to 920 ms and the main thread is free right after: busy time after `ready` is 0 in every warm cell.
- Generating voxel-model's room environment (PMREM) on every open costs 150 ms of `ready`, measured by skipping it. Baking it, item 2 of the previous report, is the largest open-time gain left.
- The largest single step is now the GPU: `host.boot:compile`, the wait for the first frame that starts no pipeline compile, takes 300 to 375 ms. Chrome compiles 31 shaders for voxel-model and 21 for voxel-map on worker threads during it.
- voxel-model allocates 73 to 84 MB per open. A third of it comes from its transform gizmo: the editor builds three `TransformControls`, each with every handle of every mode. In time it costs only about 25 ms of `editor:scene`.
- The server is idle 99% of the time.

## Opening an editor

### Baseline

Six runs per cell, medians in milliseconds from the double-click. Phases are defined in [Benchmarking](./benchmarking.md#phases).

| Editor | Mode | Phase | Ready | Ready p90 | Settled | Busy before ready | Transfer | WebSocket |
|---|---|---|---|---|---|---|---|---|
| pixel-art | online | first | 202 | 212 | 295 | 112 | 277 KB | 2 KB |
| pixel-art | online | cold | 197 | 206 | 202 | 69 | 277 KB | 2 KB |
| pixel-art | online | reload | 108 | 149 | 108 | 0 | cached | 2 KB |
| pixel-art | online | reopen | 121 | 144 | 121 | 25 | cached | 2 KB |
| voxel-map | online | first | 820 | 890 | 820 | 558 | 702 KB | 173 KB |
| voxel-map | online | cold | 728 | 770 | 728 | 428 | 702 KB | 173 KB |
| voxel-map | online | reload | 538 | 624 | 538 | 333 | cached | 173 KB |
| voxel-map | online | reopen | 581 | 676 | 581 | 420 | cached | 173 KB |
| voxel-model | online | first | 794 | 1036 | 794 | 537 | 647 KB | 3 KB |
| voxel-model | online | cold | 866 | 935 | 866 | 504 | 647 KB | 3 KB |
| voxel-model | online | reload | 639 | 840 | 639 | 453 | cached | 3 KB |
| voxel-model | online | reopen | 676 | 881 | 676 | 497 | cached | 3 KB |

Offline gives the same pixel-art and voxel-model timings within noise. voxel-map is 130 to 175 ms slower offline on warm opens (`reload` 701, `reopen` 755): its `host.boot:session` step takes 159 to 186 ms against 52 ms online, see [Offline mode](#offline-mode). voxel-map offline `first` and `cold` still show one 55 to 60 ms frame about 2 s after `ready`, which pushes their `settled` to 1.7 to 2.6 s.

Transfers are the brotli copies since the precompress fix: 702 KB for voxel-map against 3468 KB in the first October baseline. Against that baseline, warm voxel-map opens went from about 790 ms `ready` and 1380 ms `settled` to 540 ms for both; it ran in the slow state, so part of the gap is the machine.

A later run against the hosted `StudioServer` read 100 to 200 ms slower on warm voxel opens. It was not interleaved with `dev:e2e`, so the gap mixes the server with drift. In it, one voxel-map `reload` out of 18 took 3009 ms: `editor:scene` ran for 750 ms and `host.boot:compile` for 1836 ms with no long animation frame at all, so the page sat waiting on the GPU process.

### Where the time goes

Boot steps of a warm (`reload`) online open, medians of start and end in milliseconds from the click:

| Step | voxel-map | voxel-model |
|---|---|---|
| frame `DOMContentLoaded` | 82 | 121 |
| `host.boot:launch` | 60 → 74 | 69 → 136 |
| `editor.runtime:renderer` | 62 → 110 | 82 → 158 |
| `host.boot:session` | 74 → 116 | 137 → 150 |
| `editor:scene` | 129 → 158 | 163 → 368 |
| `host.boot:ready` | 209 → 214 | 395 → 397 |
| `host.boot:compile` | 227 → 467 | 399 → 670 |

- The session (catalog, target and dependency rooms) is never on the critical path: it ends with or before the renderer.
- voxel-model's `launch` waits 67 ms for the shell's reply message, which queues behind the frame's own module evaluation on the shared main thread. It ends at the same time as the renderer, so it costs nothing.
- voxel-map's hidden metrics pane (`editor:metrics`, 159 → 424) overlaps the compile wait.

### The first frame

The first animation frame runs the scene's `awake` and the first render. Inclusive CPU time from profiles of warm voxel-model opens (two online runs and one offline). Sampling every 200 µs skews these times, and they leave out GPU waits: the A/B in [Experiments](#experiments) measures 150 ms for the room environment and about 25 ms for the gizmo.

| Work | Main thread |
|---|---|
| First frame (`World.tick`) | 266 to 370 ms |
| `ModelEditorScene.awake` | 176 to 260 ms |
| of which `TransformGizmo` (`createControls`) | 72 to 137 ms |
| of which the room environment (`createRoomEnvironment`) | 98 to 114 ms |
| three.js node building (`getNodeBuilderState`) in the first render | 127 ms |

The gizmo is three `TransformControls` ([`TransformGizmo.ts`](../../../editors/voxel-model/src/features/transform/gizmo/TransformGizmo.ts)): the move, rotate and scale tool, the pivot tool and the resize tool. Each builds every handle for every mode, so the pivot and resize controls, which only translate or scale, also build three torus rings and their outlines. The outline geometry goes through `mergeVertices` and an angle-weighted miter-normal pass per vertex ([`outline.ts`](../../../three/src/transform-controls/handles/outline.ts)). None of it is visible until a block is selected.

voxel-map's first frame is lighter. Its main-thread work around the open is the Block Library: `PreviewStage.capture` 60 to 80 ms and the atlas alpha scan behind `syncAlphaModes` 14 to 18 ms. voxel-map keeps reflections off by default, so it builds no room environment at open.

### The GPU compile wait

Warm traces on 2026-10-16 ([`analyzeTrace.ts`](../../perf/analyzeTrace.ts)):

| Editor | Shaders compiled on workers | DXC on workers | DXC on the GPU main thread | Sync pipelines |
|---|---|---|---|---|
| voxel-map | 21 | 366 ms | 74 ms | 1 (25 ms) |
| voxel-model | 31 | 871 ms | 60 ms | 1 (18 ms) |

Every pipeline but one now compiles in parallel off the GPU main thread, and no frame blocks after `ready`. The `compile` step is how long the slowest of those compiles takes; it shrinks only with fewer distinct pipelines. A reload compiles the same shaders again: Chrome's shader cache did not hit across pages of the same Playwright browser.

### Allocations during an open

`perf:open --memory`, three online runs, medians:

| Editor | Phase | Allocated | GC on the main thread |
|---|---|---|---|
| pixel-art | reload | 7 MB | 16 ms |
| voxel-map | reload | 43 MB | 59 ms |
| voxel-map | cold | 48 MB | 52 ms |
| voxel-model | reload | 75 MB | 63 ms |
| voxel-model | cold | 81 MB | 45 ms |

GC costs little during an open, about a tenth of the busy time before `ready`. What the volume shows is waste:

- voxel-model: the transform gizmo allocates about 25 MB (`mergeVertices` 10.6 MB, torus geometry 7.1 MB, `computeMiterNormals` 4.6 MB, buffer attribute reads 2 MB), three.js node building 18 MB.
- voxel-map: `syncAlphaModes` 6 MB, node building 4 MB.

## An editor sitting open

[`steadyState.ts`](../../perf/steadyState.ts) opens an editor, waits 4 s, then measures 5 s with the pointer off the canvas (`away`), resting on the viewport (`hover`) and dragging it with the middle button (`orbit`). Three online runs, medians; the voxel-map rows were measured again after the Block Library fix. The `hover` rows predate the idle delay listed above:

| Editor | Scenario | Main thread | Script | Allocated | Per frame | GC |
|---|---|---|---|---|---|---|
| voxel-map | away | 23 ms/s | 6 ms/s | 0.2 MB/s | 3 KB | 5 ms/s |
| voxel-map | hover | 151 ms/s | 110 ms/s | 4.5 MB/s | 72 KB | 6 ms/s |
| voxel-map | orbit | 154 ms/s | 97 ms/s | 3.6 MB/s | 59 KB | 5 ms/s |
| voxel-model | away | 22 ms/s | 3 ms/s | 0 MB/s | 0 KB | 4 ms/s |
| voxel-model | hover | 133 ms/s | 96 ms/s | 2.8 MB/s | 45 KB | 5 ms/s |
| voxel-model | orbit | 164 ms/s | 109 ms/s | 3.6 MB/s | 59 KB | 5 ms/s |
| pixel-art | away | 17 ms/s | 2 ms/s | 0 MB/s | 0 KB | 3 ms/s |
| pixel-art | hover | 16 ms/s | 2 ms/s | 0 MB/s | 0 KB | 3 ms/s |
| pixel-art | orbit | 43 ms/s | 10 ms/s | 0.1 MB/s | 1 KB | 3 ms/s |

Every editor holds 60 frames per second with no long animation frame. GC stays under 1% of the time. Most per-frame allocations come from three.js computing render-object cache keys (`getCacheKey`, `cyrb53`, `updateForRender`): about 45 to 80 KB a frame, which our code does not control.

## The server

[`profileServer.ts`](../../perf/profileServer.ts) ran the hosted `StudioServer` in-process with the Node inspector for 240 s while `perf:open` made 36 online opens:

- 99.1% idle. Apart from Node internals (700 ms) and `js-base64` (340 ms, since removed), no package reaches 100 ms: `@openally/servo` 98 ms, `@jolly-pixel/network` 98 ms, `@jolly-pixel/image` 82 ms, Fastify 30 ms.

## Offline mode

Offline, the studio shell runs the asset server in the page, on the same main thread as the editor frames. voxel-map pays for it in `host.boot:session` (159 to 186 ms against 52 online).

## Experiments

`bench:*` flags in [`editor-open-2026-10-16.patch`](./editor-open-2026-10-16.patch), plan [`editor-open-2026-10-16.json`](./editor-open-2026-10-16.json), five interleaved rounds, online:

- `no-environment`: voxel-model skips the room environment, the upper bound of baking it.
- `one-gizmo`: voxel-model builds one `TransformControls` and reuses it for the pivot and resize tools, close to building handles per mode on demand.

voxel-model, medians of `ready` (equal to `settled` everywhere) and their difference to `control`:

| Phase | control | no-environment | one-gizmo |
|---|---|---|---|
| first | 814 | 667 (−147) | 767 (−47) |
| cold | 872 | 722 (−150) | 834 (−38) |
| reload | 886 | 739 (−147) | 868 (−18) |

The flags that do not touch voxel-map moved its medians by −95 to +47 ms, so that is the noise of this run. Only `no-environment` is above it, by the same 150 ms in every phase: `editor:scene` 176 → 98 ms and `host.boot:mount` 207 → 122 ms. The gizmo saves about 25 ms of `editor:scene`, less than its profile suggested: its gain is the 25 MB, not the time.

voxel-map's control `reload` hit the 3 s GPU stall again (p90 3017 ms) in one of its five runs.

## Recommendations

In order of gain per effort, on this machine.

| # | Change | Where | Gain | Effort |
|---|---|---|---|---|
| 1 | Bake the room environment once instead of generating it on every open (item 2 of the previous report) | voxel-model `roomEnvironment.ts`, voxel-map `SceneEnvironment` when reflections or standard-material previews need it | −147 to −150 ms `ready` on voxel-model in every phase, five pipelines fewer | medium |
| 2 | Build gizmo handles per mode on first use, or share one `TransformControls` across the voxel-model tools | `@jolly-pixel/three` `TransformGizmo`, voxel-model `TransformGizmo` | about −25 MB per voxel-model open, −25 ms of `editor:scene` | medium |
Not worth doing now:

- The `launch` wait: it ends with the renderer, off the critical path.
- The hidden metrics pane, again: it overlaps the compile wait.
- Per-frame three.js cache-key allocations: under 1% of the time in GC.
- The Block Library's `requestAnimationFrame` loop and its tile opacity rescan (`BlockPreviewMeshes.refresh`, every block every 250 ms): idle voxel-map is at 23 ms/s with both, against 22 for voxel-model.
- Shared chunks across editors, as before: only the first open of a second editor kind on a cold cache gains.

## Limits

- One machine: Intel Core Ultra 9 285HX laptop, integrated Xe-LPG GPU, Chromium on Direct3D 12. A discrete GPU or another shader compiler changes the compile wait first.
- The seed project is small: an empty map with one layer and the 1024x512 blockset, the default model and its 64x64 texture. Real maps add meshing, larger snapshots and longer room replays.
- The server profile covers warm rooms after the first open, not the replay of a cold room.
- `--memory` records a light trace and samples allocations. Its runs differed from the baseline by up to 180 ms on warm opens, in both directions; compare memory runs only with memory runs.
- The `bench:*` flags are measurement patches, not the shape the fixes should take.
