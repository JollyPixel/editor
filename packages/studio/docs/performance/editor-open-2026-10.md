# Editor open performance, October 2026

What it costs to open voxel-map, voxel-model and pixel-art from the studio, where the time goes, and which changes pay off. Measured on 2026-10-15 and 16 at `837a08fc`, before the fixes of `e5178c28`. The method, the tools and the machine are described in [Benchmarking editor opens](./benchmarking.md); every number below can be reproduced from there.

The machine ran about twice as fast during the last two runs as during the first ones (see [Limits](#limits)). Each A/B compares variants inside one interleaved run, so the differences hold; absolute times are only comparable within a table.

## Summary

- pixel-art opens in 180 to 350 ms. Nothing to fix.
- Before the fixes, voxel-map and voxel-model took 0.8 to 1 s to `ready` on a warm browser and 1.3 to 1.8 s on a cold one in the slow state, about half that in the fast state. Both kept the main thread busy for another 0.3 to 1.2 s after `ready`.
- Five changes landed in `e5178c28`; see [Fixed](#fixed). The largest one, requesting a WebGPU adapter from the shell, cuts 435 to 565 ms from the first voxel editor open of a new studio tab.
- A sixth change compiles every render pipeline asynchronously. The editors are fully drawn 228 to 424 ms sooner and no long frame follows `ready`.
- What is left happens in the GPU process:
  1. voxel-map's Block Library opens a second, WebGL, context and resizes its canvas while the GPU process is busy, which blocks the main thread after `ready`.
  2. Each open regenerates the room environment (PMREM), five pipelines and their renders.

## Baseline

Online, six runs per cell, slow state, at `837a08fc`, medians in milliseconds from the double-click. Phases are defined in [Benchmarking](./benchmarking.md#phases): `first` is a freshly launched browser, `cold` a warm browser with an empty cache, `reload` a reloaded shell, `reopen` the same shell with the tab closed and reopened.

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

## Fixed

Gains are the A/B medians of the measurement flags, taken before each change landed.

| Change | Where | Measured gain |
|---|---|---|
| The shell requests a WebGPU adapter when it boots | studio `src/index.ts` | −435 to −565 ms `ready` on the first voxel editor of a new tab; on a reload in the fast state the median holds and the p90 halves |
| `GlobalAudio` creates its `AudioListener` on first use | engine `GlobalAudio` | −228 to −257 ms `ready` in a freshly started browser, noise otherwise; one idle `AudioContext` less per editor frame |
| The bloom pass is built only while a material glows | voxel-model `ViewGlow`, `MaterialSurface.glows` | measured as `glow-off`: −175 to −381 ms `settled`, −145 to −307 ms on the worst frame after `ready`; `ready` unchanged |
| Builds write `.br` and `.gz` copies, `serveBuild` sends them | `@jolly-pixel/e2e` `precompress`, Vite configs, `serveBuild` | voxel-map eager set 3456 KB → 776 KB; invisible on localhost, about 0.44 s on a 50 Mbit/s link |
| The voxel-animation client no longer bundles the schema compiler | `asset.voxel-animation` asset kind | voxel-model eager set 3101 KB → 2796 KB, without `ata-validator` |
| Every render pipeline compiles asynchronously, and `ready` waits for the first frame that starts no compile | engine `ThreeRenderer`, runtime `compiledFrame()`, host `compile` step | −228 to −424 ms `settled`, busy after `ready` from 483–702 ms to 0; see [below](#shader-compiles-ran-one-after-the-other-on-the-gpu-process-main-thread) |

The adapter cost is per page, not per frame. Editor frames are same-origin iframes and share the shell's renderer process, so only the first `requestAdapter` of a studio document waited: 527 ms in the slow state and 234 ms in the fast one, then 17 ms for the next iframes. Before the fix it sat inside the first editor's `renderer` step, which ran from 115 to 552 ms of a warm voxel-map open while the session was done at 215 ms.

## Open findings

### Shader compiles ran one after the other on the GPU process main thread

Fixed: see [Async pipeline compiles](#async-pipeline-compiles) below.

three.js r186 takes `device.createRenderPipelineAsync()` only for pipelines that `compileAsync()` reaches, and `device.createRenderPipeline()` for every other one a render needs. Chrome compiles the shaders of the latter with DXC, one at a time, on the GPU process main thread. Counted from a warm-browser trace at `837a08fc` ([`analyzeTrace.ts`](../../perf/analyzeTrace.ts)):

| Editor | Pipelines | DXC compiles | `APICreateRenderPipeline` | DXC time |
|---|---|---|---|---|
| voxel-map | 9 | 20 | 352 ms | 376 ms |
| voxel-model | 27 | 42 | 1213 ms | 1172 ms |

The pipeline labels in a log of the WebGPU calls of a voxel-model open:

- PMREM room environment: `PMREM.Background`, `PMREM_blur` twice, `PMREM_ggx` twice.
- Bloom: `Bloom_highPass`, five `Bloom_separable`, `Bloom_comp`, and the `RenderPipeline` that composes the passes. A model without emissive materials no longer compiles these since the bloom fix.
- Scene materials and output: three `MeshStandard(Node)Material`, `MeshLambertMaterial`, four `MeshBasic(Node)Material`, `LineBasicMaterial`, `NodeMaterial`, `outputColorTransform`.

While the GPU process compiles, the page cannot present frames. That is the 1 s of long animation frames after `ready` in voxel-model, of which 1035 ms carry no script attribution at all.

[`probes/pipelineCompile.ts`](../../perf/probes/pipelineCompile.ts) creates 24 pipelines with heavy fragment shaders both ways, six interleaved rounds: synchronous creation takes 4400 to 4520 ms until the GPU is done, `createRenderPipelineAsync` 340 to 390 ms. The 12x gap means Chrome compiles async pipelines in parallel, off the GPU main thread.

`compile-async` calls `renderer.compileAsync(scene, camera)` before the first render of each scene and skips that render until it resolves (patch in [`editor-open-2026-10.patch`](../../perf/plans/editor-open-2026-10.patch)). `ready` does not move and `settled` gets 70 to 520 ms worse. It only covers scene materials: PMREM, bloom and the output pass still compile synchronously, and the delayed first frame pushes them later. `compileAsync` also waits for each pipeline before it creates the next, so even the pipelines it covers do not compile in parallel.

#### Async pipeline compiles

The three.js backend already creates a pipeline with `createRenderPipelineAsync` whenever it is handed a list to push the compile promise into, and a render already skips any object whose pipeline is not ready. `ThreeRenderer` now always hands that list over, so every pipeline takes the async path, the PMREM, bloom and output ones included, without changing three.js. Skipped objects are drawn by the frame the runtime requests once the compiles settle. The two renders that run only once, the PMREM environment and the on-demand shadow maps, are rendered again after `compiled()`.

Warm voxel-model trace on 2026-10-16:

| | Sync creates | Async creates | DXC on the GPU main thread | DXC on worker threads |
|---|---|---|---|---|
| Before | 18 | 0 | 885 ms | 0 ms |
| After | 1 | 17 | 77 ms | 929 ms |

The one synchronous pipeline left (20 ms) is created outside three.js' render path.

`ready` now waits for the first frame that starts no compile, so the first frame on screen is complete. A/B, five interleaved rounds on 2026-10-16, online, `control` running the same build with the old synchronous path:

| Editor | Phase | Ready | Settled | Busy after ready |
|---|---|---|---|---|
| voxel-map | first | 1260 → 1600 | 1876 → 1600 | 583 → 0 |
| voxel-map | cold | 991 → 1216 | 1545 → 1216 | 554 → 0 |
| voxel-map | reload | 713 → 969 | 1197 → 969 | 483 → 0 |
| voxel-model | first | 1210 → 1519 | 1902 → 1519 | 681 → 0 |
| voxel-model | cold | 1112 → 1413 | 1837 → 1413 | 683 → 0 |
| voxel-model | reload | 780 → 1069 | 1492 → 1069 | 702 → 0 |

`ready` reads 225 to 340 ms later because it now includes the compiles. Before, the frame shown at `ready` could not present until the GPU process had compiled every pipeline, so `settled` is the comparable moment: the editor is drawn and responsive 228 to 424 ms sooner.

### The Block Library runs a second, WebGL, context

voxel-map's Block Library draws its turntable thumbnails with its own `THREE.WebGLRenderer` ([`Turntable.ts`](../../../editors/voxel-map/src/features/preview/Turntable.ts)), antialiased, `preserveDrawingBuffer`, pixel ratio at least 2. In the opened editor its canvas is 710x994 for a 355x497 pane.

From CPU profiles of a warm open:

- `BlockLibraryRenderer.#syncCanvasSize` calls `renderer.setSize()` once the grid settles: 380 to 417 ms of main thread on every open, warm or cold. The resize reallocates the multisampled drawing buffer, a synchronous call into the GPU process, which is busy with the main viewport's pipelines.
- Creating the context (`getContext`) takes 297 ms in a fresh browser and 23 ms warm.
- The trace shows the renderer main thread spending 450 to 720 ms in `CommandBufferProxyImpl::WaitForGetOffset` and one 390 to 533 ms `GLES2::GetString`, both synchronous WebGL calls waiting on the GPU process. On a cold start the GPU process also links 43 GL programs (474 ms), the turntable's among them.

Long animation frames after `ready`, voxel-map control runs: 320 ms in the turntable's `requestAnimationFrame` callback and 270 ms in the viewport's `IntersectionObserver` callback that builds the renderer, out of about 690 ms.

The Block Library also costs bundle size: voxel-map carries both three.js renderers, with 195 KB of `three.module.js` and 110 KB more `three.core.js` than voxel-model.

A/B on voxel-map, five rounds, fast state. `library-off` never builds the renderer (the upper bound of any fix), `defer-library` builds it after `ready` at idle:

| Phase | Variant | Ready | Settled | Busy after ready | Longest frame after ready |
|---|---|---|---|---|---|
| cold | control | 987 | 1576 | 574 | 446 |
| cold | defer-library | 976 | 1581 | 521 | 361 |
| cold | library-off | 997 | 1432 | 358 | 278 |
| reload | control | 369 | 697 | 321 | 236 |
| reload | defer-library | 359 | 624 | 189 | 189 |
| reload | library-off | 353 | 633 | 185 | 182 |

The Block Library does not delay `ready`; it costs 135 to 215 ms of main thread right after it, and its slowest frame. Deferring it to idle recovers most of that on a warm open but not on a cold one, where the GPU process is still compiling when the idle callback fires.

### First 2D canvas

The first 2D canvas of a browser session, a 1x1 `CanvasBuffer` for the blank pixel document behind each texture lease, took 405 to 430 ms in a fresh browser in the slow state and 1 ms afterwards ([`probes/firstUse.ts`](../../perf/probes/firstUse.ts)). Only the first editor of a freshly started browser pays it.

### Download and parse

Eager chunks (the entry and its `modulepreload` links) from [`bundleComposition.ts`](../../perf/bundleComposition.ts), after the fixes:

| Editor | Raw | gzip | brotli | Largest packages |
|---|---|---|---|---|
| voxel-map | 3456 KB | 960 KB | 776 KB | three 1436 KB, ui 259 KB, editor 210 KB, voxel-renderer 192 KB |
| voxel-model | 2796 KB | 781 KB | 637 KB | three 1125 KB, ui 261 KB, pixel-draw-renderer 144 KB, editor 133 KB |
| pixel-art | 1193 KB | 328 KB | 272 KB | ui 238 KB, pixel-draw-renderer 144 KB, zod 92 KB |

- Fetch, parse and compile show in the frame's `DOMContentLoaded`: 123 ms with a warm HTTP and code cache against 422 ms cold for voxel-map.
- Each editor ships its own copy of three.js, Lit, `@jolly-pixel/ui` and `editor.host`, so the first voxel-model open after a voxel-map open downloads three.js again.

## Recommendations

In order of gain per effort. Gains are the A/B medians above, on this machine, across both states.

| # | Change | Where | Gain | Effort |
|---|---|---|---|---|
| 1 | Drop the Block Library's WebGL context: render thumbnails with the viewport's WebGPU renderer into a render target, or cache them as bitmaps | voxel-map `features/blocks/library`, `features/preview` | −135 to −215 ms of main thread after `ready`, a shorter worst frame, one GPU context and 300 KB of three.js | medium |
| 2 | Bake the room environment (PMREM) once instead of generating it on every open | voxel-model `roomEnvironment.ts`, voxel-map `SceneEnvironment` | 5 pipelines and their renders; not measured on its own | medium |

Not worth doing now:

- Skipping the hidden metrics panel (`lazy-metrics`): within noise in every phase, although its step ends 200 to 300 ms after `ready`. Its cost is the dynamic import and Lit mount of a hidden pane, small next to the GPU work around it.
- Deferring the Block Library renderer instead of removing its context: it moves the work instead of removing it.
- Scene-only `compileAsync`: worse, see above.
- Shared chunks across editors: only helps the first open of a second editor kind on a cold cache.

## Limits

- The fixes have not been measured again since they landed. Their gains come from the measurement flags, and the bloom fix was measured as glow off, which matches it only for a model without emissive materials.
- Machine drift. The baseline, the profiles, the traces and the first A/B ran in a slow state on 2026-10-15; the Block Library A/B and the confirmation A/B ran in a fast state after midnight, with mains power and the same power plan throughout. A fresh browser's first `requestAdapter` went from 1232 to 586 ms between the two, and warm opens from about 870 to 350 ms. The cause was not isolated: thermal state, or the GPU driver's shader cache filling up across hundreds of runs.
- One machine with an integrated Intel GPU, Chromium on Direct3D. A discrete GPU, macOS (Metal) or a different shader compiler changes the GPU-process numbers, likely downwards; the ordering of the findings should hold.
- The seed project is small: an empty map with one layer and the 1024x512 blockset, the default model and its 64x64 texture. Real maps add meshing and snapshot time that these runs do not cover.
- Server rooms were warm for every measurement after the first; cold room replays are not measured.
- The `bench:*` flags are measurement patches, not the shape the fixes should take.
