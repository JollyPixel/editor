# Editor open performance, October 2026

What it costs to open voxel-map, voxel-model and pixel-art from the studio, where the time goes, and which changes pay off. Measured on 2026-10-15 and 16 at `837a08fc`. The method, the tools and the machine are described in [Benchmarking editor opens](./benchmarking.md); every number below can be reproduced from there.

The machine ran about twice as fast during the last two runs as during the first ones (see [Limits](#limits)). Each A/B compares variants inside one interleaved run, so the differences hold; absolute times are only comparable within a table.

## Summary

- pixel-art opens in 180 to 350 ms. Nothing to fix.
- voxel-map and voxel-model take 0.8 to 1 s to `ready` on a warm browser and 1.3 to 1.8 s on a cold one in the slow state, about half that in the fast state. Both keep the main thread busy for another 0.3 to 1.2 s after `ready`.
- The time is spent in the GPU process more than in JavaScript. Three costs dominate:
  1. The first WebGPU adapter request of a new studio page takes 230 to 530 ms, and it sits on the critical path of the first editor opened in that page.
  2. three.js creates WebGPU pipelines synchronously. Every shader compiles one after the other on the GPU process main thread: 27 pipelines and 1.2 s of DXC compiles for voxel-model, 9 pipelines and 0.4 s for voxel-map. Every WebGL call and every frame in the page waits behind them.
  3. voxel-map's Block Library opens a second, WebGL, context and resizes its canvas while the GPU process is busy, which blocks the main thread after `ready`.
- Requesting a WebGPU adapter from the shell as soon as it loads cuts 435 to 565 ms from the first voxel editor open of a new studio tab, in both machine states. It is a few lines of code.
- With the changes measured here combined, a cold voxel-map open goes from 970 to 498 ms and a cold voxel-model open from 1091 to 575 ms, with voxel-model settling 763 ms sooner (fast state).
- The studio dev server could not serve the shell on Windows at `837a08fc`; see [Dev server bug](#dev-server-bug).

## Baseline

Online, six runs per cell, slow state, medians in milliseconds from the double-click. Phases are defined in [Benchmarking](./benchmarking.md#phases): `first` is a freshly launched browser, `cold` a warm browser with an empty cache, `reload` a reloaded shell, `reopen` the same shell with the tab closed and reopened.

| Editor | Phase | Ready | Ready p90 | Settled | Busy after ready | Transfer | WebSocket |
|---|---|---|---|---|---|---|---|
| pixel-art | first | 296 | 315 | 403 | 76 | 1197 KB | 2 KB |
| pixel-art | cold | 320 | 368 | 329 | 0 | 1197 KB | 2 KB |
| pixel-art | reload | 182 | 224 | 190 | 0 | cached | 2 KB |
| pixel-art | reopen | 202 | 238 | 223 | 0 | cached | 2 KB |
| voxel-map | first | 1478 | 1573 | 2471 | 970 | 3468 KB | 173 KB |
| voxel-map | cold | 1304 | 1340 | 2064 | 735 | 3468 KB | 173 KB |
| voxel-map | reload | 789 | 961 | 1378 | 581 | cached | 173 KB |
| voxel-map | reopen | 785 | 925 | 1395 | 596 | cached | 173 KB |
| voxel-model | first | 1613 | 1830 | 2798 | 1154 | 3112 KB | 3 KB |
| voxel-model | cold | 1445 | 1547 | 2641 | 1159 | 3112 KB | 3 KB |
| voxel-model | reload | 930 | 1051 | 2018 | 1115 | cached | 3 KB |
| voxel-model | reopen | 945 | 1037 | 2037 | 1087 | cached | 3 KB |

Offline gives the same editor timings within noise. Its `settled` reads up to 1.5 s later only because of one 55 to 60 ms frame about 2 s after `ready`, attributed to the shell's offline workspace (an `OwnerWorkspace` message and a host `setTimeout`).

The voxel-map socket bytes are the blockset snapshot, a 1024x512 PNG. Room joins stay small: the session's `catalog`, `target` and `dependency` steps finish within 220 ms of the click on a warm open.

### Where a warm open spends its time

voxel-map, online, `reload`, medians:

| Step | Start | End |
|---|---|---|
| `host.boot:launch` | 110 | 138 |
| `editor.runtime:renderer` | 115 | 552 |
| `host.session:target` + `dependency` | 166 | 215 |
| `editor.runtime:stats` | 623 | 632 |
| `editor:scene` | 642 | 681 |
| `host.boot:mount` | 215 | 707 |
| `ready` | | 767 |
| `editor:metrics` (after ready) | 682 | 1064 |

The session is done at 215 ms. `mount` then waits for the runtime's `renderer` step, which runs from 115 to 552 ms. voxel-model has the same shape: the renderer step ends at 596 ms and `ready` comes at 925 ms after a 120 ms `scene` step.

The renderer step is `new WebGPURenderer()` plus `init()`. The trace shows the main thread mostly idle between 380 and 900 ms after the click, so the step is waiting on something else. Instrumenting the WebGPU calls in the frame shows `navigator.gpu.requestAdapter()` resolving 545 ms after it was called, while the GPU process runs one 514 ms WebGPU task.

## Findings

### 1. The first WebGPU adapter of a page costs 230 to 530 ms

[`probes/firstUse.ts`](../../perf/probes/firstUse.ts), in the slow and in the fast state:

| Where | `requestAdapter` slow | fast | `requestDevice` |
|---|---|---|---|
| fresh browser, first page | 1232 ms | 586 ms | 128 to 230 ms |
| same page, again | 1 ms | 0 ms | 10 to 15 ms |
| new iframe in that page | 17 to 20 ms | 12 ms | 7 to 14 ms |
| new studio shell document, first request | 527 ms | 234 ms | 8 to 18 ms |
| new studio shell document, next iframes | 17 ms | 16 ms | 7 to 13 ms |

The cost is per page, not per frame: editor frames are same-origin iframes and share the shell's renderer process, so only the first request pays. `powerPreference` and the list of required features make no difference (14 ms either way, measured). The shell never touches WebGPU, so the first editor opened after a studio load pays it inside its `renderer` step.

A/B, `prewarm` against control, `ready` medians over five interleaved rounds:

| Editor | State | first | cold | reload |
|---|---|---|---|---|
| voxel-map | slow | 1548 → 1044 (−504) | 1475 → 910 (−565) | 873 → 548 (−325) |
| voxel-map | fast | | 970 → 535 (−435) | 353 → 360, p90 747 → 364 |
| voxel-model | slow | 1830 → 1326 (−504) | 1653 → 1095 (−558) | 1033 → 683 (−350) |
| voxel-model | fast | | 1091 → 614 (−477) | 415 → 411, p90 660 → 430 |

`settled` moves by the same amount. On a new tab (`cold`) the gain holds in both states. On a reloaded tab in the fast state the stall hits only some opens: the median does not move, the 90th percentile halves. A second editor opened in the same shell already finds the adapter warm, so it should gain nothing; that case was not measured.

### 2. Synchronous pipeline creation serializes shader compiles on the GPU process

three.js r186 calls `device.createRenderPipeline()` (synchronous) for every pipeline a render needs. Chrome then compiles each shader with DXC, one at a time, on the GPU process main thread. Counted from a warm-browser trace ([`analyzeTrace.ts`](../../perf/analyzeTrace.ts)):

| Editor | Pipelines | DXC compiles | `APICreateRenderPipeline` | DXC time |
|---|---|---|---|---|
| voxel-map | 9 | 20 | 352 ms | 376 ms |
| voxel-model | 27 | 42 | 1213 ms | 1172 ms |

The pipeline labels in a log of the WebGPU calls of a voxel-model open:

- PMREM room environment: `PMREM.Background`, `PMREM_blur` twice, `PMREM_ggx` twice.
- Bloom, the glow view setting, on by default: `Bloom_highPass`, five `Bloom_separable`, `Bloom_comp`, and the `RenderPipeline` that composes the passes.
- Scene materials and output: three `MeshStandard(Node)Material`, `MeshLambertMaterial`, four `MeshBasic(Node)Material`, `LineBasicMaterial`, `NodeMaterial`, `outputColorTransform`.

While the GPU process compiles, the page cannot present frames. That is the 1 s of long animation frames after `ready` in voxel-model, of which 1035 ms carry no script attribution at all.

[`probes/pipelineCompile.ts`](../../perf/probes/pipelineCompile.ts) creates 24 pipelines with heavy fragment shaders both ways, six interleaved rounds: synchronous creation takes 4400 to 4520 ms until the GPU is done, `createRenderPipelineAsync` 340 to 390 ms. The 12x gap means Chrome compiles async pipelines in parallel, off the GPU main thread.

Two A/Bs probed this from the editor side:

- `glow-off` (`voxel-model:view` = `{"glow":false}`) removes the bloom pipelines. In the slow state voxel-model `settled` drops by 289 to 381 ms and the longest frame after `ready` from 815 to 508 ms on a warm open; in the fast state `settled` drops by 175 to 249 ms and the longest frame by 145 to 246 ms. `ready` does not move: the bloom compiles after it.
- `compile-async` calls `renderer.compileAsync(scene, camera)` before the first render of each scene and skips that render until it resolves (patch in [`editor-open-2026-10.patch`](../../perf/plans/editor-open-2026-10.patch)). `ready` does not move and `settled` gets 70 to 520 ms worse. It only covers scene materials: PMREM, bloom and the output pass still compile synchronously, and the delayed first frame pushes them later. Async compilation has to cover every pipeline to pay off.

### 3. The Block Library runs a second, WebGL, context

voxel-map's Block Library draws its turntable thumbnails with its own `THREE.WebGLRenderer` ([`Turntable.ts`](../../../editors/voxel-map/src/features/preview/Turntable.ts)), antialiased, `preserveDrawingBuffer`, pixel ratio at least 2. In the opened editor its canvas is 710x994 for a 355x497 pane.

From CPU profiles of a warm open:

- `BlockLibraryRenderer.#syncCanvasSize` calls `renderer.setSize()` once the grid settles: 380 to 417 ms of main thread on every open, warm or cold. The resize reallocates the multisampled drawing buffer, a synchronous call into the GPU process, which is busy with the main viewport's pipelines.
- Creating the context (`getContext`) takes 297 ms in a fresh browser and 23 ms warm.
- The trace shows the renderer main thread spending 450 to 720 ms in `CommandBufferProxyImpl::WaitForGetOffset` and one 390 to 533 ms `GLES2::GetString`, both synchronous WebGL calls waiting on the GPU process. On a cold start the GPU process also links 43 GL programs (474 ms), the turntable's among them.

Long animation frames after `ready`, voxel-map control runs: 320 ms in the turntable's `requestAnimationFrame` callback and 270 ms in the viewport's `IntersectionObserver` callback that builds the renderer, out of about 690 ms.

The Block Library also costs bundle size: voxel-map carries both three.js renderers, with 195 KB of `three.module.js` and 110 KB more `three.core.js` than voxel-model.

A/B on voxel-map, five rounds, `library-off` never builds the renderer (the upper bound of any fix), `defer-library` builds it after `ready` at idle. This run came later, with the machine about twice as fast (see [Limits](#limits)):

| Phase | Variant | Ready | Settled | Busy after ready | Longest frame after ready |
|---|---|---|---|---|---|
| cold | control | 987 | 1576 | 574 | 446 |
| cold | defer-library | 976 | 1581 | 521 | 361 |
| cold | library-off | 997 | 1432 | 358 | 278 |
| reload | control | 369 | 697 | 321 | 236 |
| reload | defer-library | 359 | 624 | 189 | 189 |
| reload | library-off | 353 | 633 | 185 | 182 |

The Block Library does not delay `ready`; it costs 135 to 215 ms of main thread right after it, and its slowest frame. Deferring it to idle recovers most of that on a warm open but not on a cold one, where the GPU process is still compiling when the idle callback fires.

### 4. One-off browser costs land on the first editor

Measured in a fresh browser by CPU profile and [`probes/firstUse.ts`](../../perf/probes/firstUse.ts):

- `GlobalAudio` creates a `THREE.AudioListener`, hence an `AudioContext`, inside `Runtime.create`, although no editor plays sound: 369 ms (voxel-map) and 163 ms (voxel-model) in a fresh browser in the slow state, 30 to 90 ms per context otherwise. Every editor frame also keeps that context open until it is closed.
- The first 2D canvas of the session, a 1x1 `CanvasBuffer` for the blank pixel document behind each texture lease, took 405 to 430 ms in a fresh browser in the slow state and 1 ms afterwards.

`lazy-audio` (create the listener on first use; cameras default to `addAudioListener: false`), change of the `ready` median:

| Editor | State | first | cold | reload |
|---|---|---|---|---|
| voxel-map | slow | −228 | −54 | −12 |
| voxel-map | fast | | −13 | −27 |
| voxel-model | slow | −257 | −110 | −34 |
| voxel-model | fast | | −75 | −32 |

It pays off in a freshly started browser and is within noise otherwise. It still removes one idle `AudioContext` per editor frame.

### 5. Download and parse

Eager chunks (the entry and its `modulepreload` links) from [`bundleComposition.ts`](../../perf/bundleComposition.ts):

| Editor | Raw | gzip | brotli | Largest packages |
|---|---|---|---|---|
| voxel-map | 3456 KB | 960 KB | 775 KB | three 1436 KB, ui 259 KB, editor 210 KB, voxel-renderer 192 KB, pixel-draw-renderer 143 KB |
| voxel-model | 3101 KB | 858 KB | 701 KB | three 1125 KB, ata-validator 310 KB, ui 261 KB, pixel-draw-renderer 144 KB, editor 133 KB |
| pixel-art | 1193 KB | 328 KB | 273 KB | ui 238 KB, pixel-draw-renderer 144 KB, zod 92 KB |

- Nothing is compressed. `serveBuild` (dev and hosted server) sends the 2.1 MB voxel-map entry chunk as is to a client that accepts `br`, and [Hosting](../hosting.md) does not ask the proxy to compress. Over a 50 Mbit/s link the voxel-map eager set takes about 0.57 s raw against 0.13 s with brotli. On localhost, where these runs happen, transfer is not visible.
- voxel-model preloads `ata-validator` (310 KB raw), the validator of the offline back-end. voxel-map and pixel-art load it lazily.
- Fetch, parse and compile show in the frame's `DOMContentLoaded`: 123 ms with a warm HTTP and code cache against 422 ms cold for voxel-map.
- Each editor ships its own copy of three.js, Lit, `@jolly-pixel/ui` and `editor.host`, so the first voxel-model open after a voxel-map open downloads three.js again.

### 6. No measurable effect

- `lazy-metrics`, skipping the hidden metrics panel: within noise in every phase, although its step ends 200 to 300 ms after `ready`. Its cost is the dynamic import and Lit mount of a hidden pane, small next to the GPU work around it.
- `defer-library`, building the Block Library renderer after `ready` at idle: `ready` within noise, longest frame after `ready` 54 to 167 ms shorter. It moves the work instead of removing it.

## Recommendations

In order of gain per effort. Gains are the A/B medians above, on this machine, across both states.

| # | Change | Where | Gain | Effort |
|---|---|---|---|---|
| 1 | Request a WebGPU adapter from the shell once it is interactive (`requestIdleCallback`) | studio `src/index.ts` | −435 to −565 ms `ready` on the first voxel editor of a new tab; removes the slow tail on reloads | small |
| 2 | Create the `AudioListener` on first use, never in `Runtime.create` | engine `GlobalAudio` | −230 to −260 ms in a freshly started browser, noise otherwise; one `AudioContext` less per frame | small |
| 3 | Compile bloom only when glow has something to show (emissive materials), or default glow off | voxel-model `ViewGlow` | −175 to −380 ms `settled`, −145 to −300 ms on the worst frame after `ready` | small |
| 4 | Drop the Block Library's WebGL context: render thumbnails with the viewport's WebGPU renderer into a render target, or cache them as bitmaps | voxel-map `features/blocks/library`, `features/preview` | −135 to −215 ms of main thread after `ready`, a shorter worst frame, one GPU context and 300 KB of three.js | medium |
| 5 | Precompress editor pages at build time (`.br`/`.gz`) and serve them with servo `precompressed`, or document proxy compression | studio `serveBuild`, editor builds, `docs/hosting.md` | 3.4 MB → 0.78 MB for voxel-map | small |
| 6 | Load `ata-validator` lazily in voxel-model like the other editors | voxel-model entry imports | −310 KB eager | small |
| 7 | Create every pipeline asynchronously: warm up PMREM, bloom and the output pass with `compileAsync`, or render the first frames only once `createRenderPipelineAsync` resolves | engine render path, possibly upstream three.js | up to 1.2 s of GPU-process time for voxel-model, 0.4 s for voxel-map (probe: 12x faster for 24 pipelines) | large |
| 8 | Bake the room environment (PMREM) once instead of generating it on every open | voxel-model `roomEnvironment.ts`, voxel-map `SceneEnvironment` | 5 pipelines and their renders; not measured on its own | medium |

Not worth doing now: the lazy metrics panel (no measurable gain), deferring the Block Library renderer instead of removing its context (it only moves the work), scene-only `compileAsync` (worse), shared chunks across editors (only helps the first open of a second editor kind on a cold cache).

### Combined

`combined` stacks 1, 2, 3, the metrics skip and the deferred library, the changes available behind flags. Medians, control → combined:

| Editor | State | Metric | first | cold | reload |
|---|---|---|---|---|---|
| voxel-map | slow | ready | 1548 → 888 | 1475 → 820 | 873 → 480 |
| voxel-map | slow | settled | 2608 → 1936 | 2287 → 1590 | 1544 → 1184 |
| voxel-map | fast | ready | | 970 → 498 | 353 → 300 |
| voxel-map | fast | settled | | 1502 → 1037 | 723 → 622 |
| voxel-model | slow | ready | 1830 → 1100 | 1653 → 1017 | 1033 → 607 |
| voxel-model | slow | settled | 3092 → 2076 | 3003 → 2015 | 2175 → 1508 |
| voxel-model | fast | ready | | 1091 → 575 | 415 → 385 |
| voxel-model | fast | settled | | 2089 → 1326 | 932 → 820 |

## Dev server bug

At `837a08fc`, `pnpm --filter @jolly-pixel/studio dev:e2e` served a blank shell on Windows. `ManifestRoute` mounts a servo handler at `/` to answer `project-manifest.json`, and servo answers before Vite does: 404 for any path with a dot segment, such as `/node_modules/.vite/deps/lit.js`, and 403 for `/@fs/D:/…`, whose drive colon servo rejects. The fix used for these measurements forwards every other path to the next middleware ([`server/editors/ManifestRoute.ts`](../../server/editors/ManifestRoute.ts)). The dot-segment 404 does not depend on the OS.

## Limits

- Machine drift. The baseline, the profiles, the traces and the first A/B ran in a slow state on 2026-10-15; the Block Library A/B and the confirmation A/B ran in a fast state after midnight, with mains power and the same power plan throughout. A fresh browser's first `requestAdapter` went from 1232 to 586 ms between the two, and warm opens from about 870 to 350 ms. The cause was not isolated: thermal state, or the GPU driver's shader cache filling up across hundreds of runs.
- One machine with an integrated Intel GPU, Chromium on Direct3D. A discrete GPU, macOS (Metal) or a different shader compiler changes the GPU-process numbers, likely downwards; the ordering of the findings should hold.
- The seed project is small: an empty map with one layer and the 1024x512 blockset, the default model and its 64x64 texture. Real maps add meshing and snapshot time that these runs do not cover.
- Server rooms were warm for every measurement after the first; cold room replays are not measured.
- The `bench:*` flags are measurement patches, not the shape the fixes should take.
