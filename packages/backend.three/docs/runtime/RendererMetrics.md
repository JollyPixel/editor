# RendererMetrics

`runtime.metrics.renderer` is the `RendererMetrics` of the three.js backend.

The runtime registers the `WebGPURenderer` counters under the `renderer` group,
outside the HUD cycle: `calls`, `renderedTriangles`, `geometries`, `textures`,
and the byte counts `geometryMemory` and `textureMemory`.

A renderer created with timestamp tracking also gets `gpuTime`, the GPU
milliseconds of the last drawn frame, read back after every `"draw"`:

```ts
const runtime = await Runtime.create(canvas, {
  renderer: {
    webgpu: {
      trackTimestamp: true
    }
  }
});
```

Three.js turns tracking off on a device without the `timestamp-query`
feature, and the metric is then absent. Every read-back copies the queries
out of the GPU, so keep tracking off outside measurements. A frame drawn while
the previous read-back is still pending is added to the next value.

Three.js resets `renderer.info.render` on every animation-loop tick, including
the ticks the `maxFps` cap skips, so a read outside a `"draw"` handler mostly
sees zero. Read `renderer.frame` instead:

```ts
const { drawCalls, triangles } = runtime.metrics.renderer.frame;
```

It returns a new `RendererFrameStats` on every read. `drawCalls` and
`triangles` come from the last drawn frame; `geometries` and `textures` are
live. To refresh a display at the recorder's pace, read it from
`runtime.stats.subscribe()`.
