# Benchmarking editor opens

How to measure what it costs to open an editor from the studio, and how to A/B a change against it. The tools live in `packages/studio/perf/`, starting with [`openEditors.ts`](../../perf/openEditors.ts); the October 2026 results are in [the editor-open report](./editor-open-2026-10.md).

## What is measured

One measurement is one double-click on an asset row, timed until the editor frame settles. Every time is relative to the `dblclick` event in the shell:

- `ready`: the frame's `<html data-editor-state>` turns `ready`, the state the tab spinner waits for.
- `settled`: the end of the last long animation frame (over 50 ms) in the 4 s after `ready`. An editor can report `ready` and keep the main thread busy for another second; `settled` is when it stops.
- `busy before ready` and `busy after ready`: the summed duration of long animation frames on either side of `ready`. Same-origin frames share the shell's main thread, so the shell's observer sees the frames' work too.
- Boot steps: every `logger.step()` of `host.boot`, `host.session`, `editor.runtime` and the editor, from the `[DEBUG] [ns] <step> started|done` console lines that `jolly-pixel:debug=*` turns on. Steps run concurrently, so their durations overlap; read the `start` and `end` columns, not the sum.
- Transfer: the frame's Resource Timing entries (requests, transfer and decoded bytes) and the WebSocket bytes received after the click.

The page probe ([`perf/pageProbe.ts`](../../perf/pageProbe.ts)) is an init script, so it runs in the shell and in every editor frame before their own code.

## Phases

Each phase changes which caches are warm:

| Phase | Browser process, GPU process | HTTP cache, storage | Page |
|---|---|---|---|
| `first` | fresh launch | empty | new shell |
| `cold` | warm (a `first` ran before) | empty, new context | new shell |
| `reload` | warm | warm | shell reloaded, editor never opened in it |
| `reopen` | warm | warm | same shell, tab closed and opened again |

`first` includes one-off browser costs: the first WebGPU adapter in a fresh browser takes over a second, the first `AudioContext` a few hundred milliseconds. Users who already run Chrome pay them less often; read `cold` and `reload` for the cost of the studio itself.

Server rooms stay open for `roomGraceMs` (5 min) after the last peer leaves, so only the first open after a server start replays a room. Restart `dev:e2e` to measure a cold room.

## Running the matrix

Build every workspace, then start the studio in e2e mode (in-memory back-end and accounts, port 3004):

```bash
$ pnpm run build
$ pnpm --filter @jolly-pixel/studio dev:e2e
```

In a second terminal:

```bash
$ cd packages/studio
$ pnpm run perf:open --runs 6 --out perf-results/baseline.json
$ pnpm run perf:summary perf-results/baseline.json
$ pnpm run perf:summary perf-results/baseline.json --steps --phase reload
```

`perf:open` options:

- `--editors voxel-map,voxel-model,pixel-art` and `--modes online,offline`: what to open. Online registers a new account per context; offline opens `/?offline`.
- `--phases first,reopen,reload,cold`: `first` always runs.
- `--runs 6`: repetitions. Each run shuffles modes and editors and launches a new browser per editor.
- `--label`: tags every measurement, for summaries that mix files.
- `--storage '{"key":"value"}'`: `localStorage` entries written before any page script runs.
- `--prewarm`: the shell requests a WebGPU adapter as soon as it loads.
- `--cpu 4`: CDP CPU throttling.
- `--profile <dir>`: records a V8 CPU profile of each open.
- `--headless`: avoid it. Headless Chromium renders with SwiftShader, which makes WebGPU and WebGL costs meaningless.

The browser window must stay visible: a hidden or minimized window stops `requestAnimationFrame`, and the editors never reach their first frame.

## A/B protocol

Laptop speed drifts with power and thermal state, so never compare two runs taken at different times. Compare variants inside one interleaved run:

```bash
$ pnpm run perf:ab --plan perf/plans/editor-open-2026-10.json --rounds 5 --out perf-results/ab
$ pnpm run perf:summary perf-results/ab --control control
```

[`perf/abRun.ts`](../../perf/abRun.ts) runs one round of every variant, then the next round in reverse order, so a slow period hits every variant alike. `--control` prints each median with its difference to the control. With five rounds, treat differences under about 50 ms on `ready` as noise, and read the p90 column too: a stall that hits only some opens moves the p90 and not the median.

Drift between runs can be large: in October 2026 the same warm open went from about 870 to 350 ms over one evening. Run `perf/probes/firstUse.ts` before and after a session; if its numbers moved, report each A/B with the state it ran in and do not compare absolute times across runs.

A variant in a plan file has a `label` and any of:

- `storage`: `localStorage` entries. This covers editor settings that persist there (`voxel-model:view` for glow and environment) and the `bench:*` flags of an experiment patch.
- `prewarm`: shell-side WebGPU warm-up.
- `base`: another studio URL, to compare two servers.

### Testing a code change

Build the change once behind a `localStorage` flag, so control and variant run the same bundle:

```bash
$ git worktree add D:/Sources/JollyPixel/jpb HEAD
$ cd D:/Sources/JollyPixel/jpb
$ pnpm install --frozen-lockfile --prefer-offline
$ git apply packages/studio/perf/plans/editor-open-2026-10.patch
$ pnpm run build
$ pnpm --filter @jolly-pixel/studio dev:e2e
```

Then run `perf:ab` from the main checkout as above: the plan's variants turn the flags on, and the control runs the same build without them. Stop the main checkout's `dev:e2e` first, since both use port 3004. On Windows keep the worktree path short, as deep scratch paths exceed `MAX_PATH` during the build.

[`editor-open-2026-10.patch`](../../perf/plans/editor-open-2026-10.patch) holds the October experiments: `bench:lazy-audio`, `bench:defer-library` (`1` defers the Block Library renderer, `off` never builds it), `bench:lazy-metrics` and `bench:compile-async`. The patch is measurement scaffolding, not a fix to merge.

Do not build or run tests while a measurement runs.

## Finding where the time goes

### CPU profiles

Build the editor pages with source maps, so profiles resolve to source files and packages:

```bash
$ cd packages/editors/voxel-map && pnpm exec vite build --sourcemap
$ cd ../voxel-model && pnpm exec vite build --sourcemap
$ cd ../pixel-art && pnpm exec vite build --sourcemap
```

Record and read a profile:

```bash
$ pnpm run perf:open --runs 1 --modes online --phases reload --profile perf-results/profiles
$ node perf/analyzeProfile.ts perf-results/profiles/<file>.cpuprofile --top 30
$ node perf/analyzeProfile.ts <file> --stacks "getContext|setSize" --depth 12
$ node perf/analyzeProfile.ts <file> --from 100 --until 700
```

It prints self time by package, file and function. `--stacks` prints the callers of matching functions; `--from`/`--until` keep the samples of one window, in milliseconds from the start of the profile (just before the click). A native call that waits on the GPU process, such as `getContext`, `setSize` or a WebGL `getParameter`, shows as self time of the JavaScript function that made it.

### Chrome traces

A CPU profile cannot see the GPU process. When the main thread is idle while a step waits, take a trace:

```bash
$ node perf/traceOpen.ts --editor voxel-model --warm
$ node perf/analyzeTrace.ts perf-results/traces/voxel-model-warm.json
```

`--warm` opens the editor once and reloads the shell before tracing. The analysis prints self time per event on the renderer and GPU main threads, the pipeline and shader compiles (`APICreateRenderPipeline`, `CompileShaderDXC`, `Program::MainLinkLoadEvent::wait`), the synchronous waits of the page on the GPU process (`CommandBufferProxyImpl::WaitForGetOffset`), and the main-thread tasks over 15 ms after the click. Open the same file in the DevTools Performance panel for the full picture.

### Probes

Small pages that isolate one browser cost:

```bash
$ node perf/probes/firstUse.ts
$ node perf/probes/pipelineCompile.ts --pipelines 24 --rounds 6
```

- `firstUse`: WebGPU adapter and device, `AudioContext`, WebGL and 2D canvas creation, in a fresh browser, in a new iframe, and in a new studio shell document.
- `pipelineCompile`: N WebGPU render pipelines created with `createRenderPipeline` against `createRenderPipelineAsync`.

### Bundles

```bash
$ node perf/bundleComposition.ts
```

Needs the source-map build. Prints, per editor, the eager chunks (the entry plus its `modulepreload` links) raw, gzip and brotli, and their bytes by package, then the lazy chunks. Bytes the minifier emits without a mapping show as `(unmapped)`.

## Environment of the October 2026 run

- Windows 11 Pro 26200, Intel Core Ultra 9 285HX laptop with 32 GB, integrated Intel Graphics (Xe-LPG) only.
- Playwright 1.64 with Chromium 156.0.8078.4, headed. WebGL runs through ANGLE on Direct3D 11, WebGPU through Dawn on Direct3D 12.
- Node.js 24.18, studio `dev:e2e`, editors built from `837a08fc`.
