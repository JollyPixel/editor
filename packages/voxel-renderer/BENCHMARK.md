# Benchmarks

## Noise-world benchmark

Use the `/noise-world/` example (`pnpm --filter @jolly-pixel/voxel.renderer dev`)
to measure the renderer under load. It builds a heightmap world from layered
simplex noise (continents, ridged mountains, domain warp) and reports two
separate costs: voxel writes via `setVoxel` and chunk meshing for dirty chunks.

It is configurable from the query string:

```text
/noise-world/?size=1024&chunk=32&seed=42
```

| Param | Default | Effect |
|---|---:|---|
| `size` | `512` | World width/depth in voxels (`size²` columns) |
| `chunk` | `32` | `chunkSize`; trades draw calls against rebuild cost |
| `seed` | `1337` | Terrain seed; the same seed always yields the same world |
| `workers` | `2` up to 512, `4` above | Mesh workers, capped at `hardwareConcurrency - 1`; `0` meshes on the main thread |

The examples dev server sends `Cross-Origin-Opener-Policy` and
`Cross-Origin-Embedder-Policy` headers, which mesh workers need for
`SharedArrayBuffer`.

## Headless benchmark

The browser HUD is only a sanity check; Vite's checker inflates timings. Run
headless instead:

```bash
pnpm run bench
pnpm run bench --workers 8
pnpm run bench:compare
```

`--workers N` meshes in N `worker_threads` ticked at 60 fps; `main thread` then
reports the event loop busy time instead of the flush duration.

Use the minimum of three runs when comparing numbers, since single runs can
drift a lot on a throttled machine.

## Block light and frame benchmarks

```bash
pnpm run bench:light --size 256 --lights 300
pnpm run bench:render --size 256 --lights 400 --resolution 1024
pnpm run bench:render --webgpu
```

`block-light.bench.ts` times the CPU side of block light on a stone floor with
scattered lights and pillars: first and full relight, texture fill, falloff
switch, single edits and the idle update. `--tint` sets the light colour. A
coloured light relights on a falloff switch; a white one only rewrites its
textures.

`render.bench.ts` reports the frame time of a lit map in headless Chrome (WebGL
by default, `--webgpu` for WebGPU), with and without block light, glass and the
glow pass. Three only advances its node frame inside the animation loop, so the
bench page swaps `requestAnimationFrame` for an unthrottled one. The numbers
are throughput, not latency, and only compare between runs on the same
machine.
