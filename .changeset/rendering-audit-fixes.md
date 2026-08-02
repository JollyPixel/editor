---
"@jolly-pixel/engine": major
"@jolly-pixel/runtime": minor
---

Fix the rendering path issues found in the `RENDERING-AUDIT.md` review.

**Cameras are now driven by their actor.** `CameraComponent` sets `matrixWorldAutoUpdate = false` on its `THREE.Camera`, so the transform `prepareRender` copies from `actor.object3D` survives instead of being recomposed by three right before the draw. Moving or parenting the actor now moves the camera, as the `Renderer` contract always claimed.

*Breaking:* writes to `component.camera.position` / `.quaternion` / `.rotation` no longer have any effect — they are overwritten every frame. Move the camera through `actor.transform` instead:

```diff
-component.camera.position.set(10, 10, 5);
-component.camera.lookAt(0, 0, 0);
+component.actor.transform
+  .setLocalPosition({ x: 10, y: 10, z: 5 })
+  .lookAt({ x: 0, y: 0, z: 0 });
```

**`Camera3DControls` no longer discards its camera options.** `near`, `far`, `fov`, `projectionMode`, `orthographicScale`, `viewport` and `depth` were dropped on the floor and every camera silently got the `CameraOptions` defaults.

**The renderer is configurable.** `ThreeRendererOptions` gains a `webgl` passthrough for context-creation parameters (`antialias`, `alpha`, `logarithmicDepthBuffer`, …) and an `output` object for the mutable renderer state (`pixelRatio`, `shadows`, `outputColorSpace`, `toneMapping`, `toneMappingExposure`). `antialias` in particular could not be turned off at all before, which matters for voxel and pixel-art projects where MSAA extrapolates UVs past triangle edges and bleeds neighbouring atlas tiles.

Default changes: the device pixel ratio is now capped at 2 (was uncapped — 9× the fragments on a 3× DPR display), `powerPreference` is `"high-performance"`, and shadow maps are opt-in rather than forced on at `BasicShadowMap` quality. Everything affecting the rendered image — `alpha`, tone mapping, exposure, `near`/`far` — keeps its previous default.

**Resources are released.** `Renderer` gains `dispose()`, implemented by `ThreeRenderer`, and `World.dispose()` / `Runtime.dispose()` sequence the teardown. Nothing disposed the WebGL renderer before, so every dropped `World` leaked a GL context — browsers cap live contexts at ~16, after which rendering stops. `setRenderMode` now disposes the strategy it replaces (an `EffectComposer` and its two full-size render targets), and removing a camera disposes its render pass.

**Composer mode works with more than one camera.** Each camera's `RenderPass` used to clear the frame, wiping the previous camera's output so only the last one was visible. Passes are now ordered by camera `depth`, and only the first clears the color buffer; the rest clear depth so overlay cameras composite. Per-camera viewports are still unsupported in composer mode, but now warn instead of failing silently.

**`setProjectionMode` no longer leaves stale references.** Swapping projection dropped the attached `AudioListener` and the layer mask on the discarded camera, and left the composer rendering through the old one — the render pass was keyed by camera identity, so it could never be found or removed again. Passes are now keyed by component, and the listener and layers move across.

Also: the depth-sorted camera list is cached instead of being copied and re-sorted every frame, renderer warnings go through the engine `Logger` (configurable via `ThreeRendererOptions.logger`), `resize()` is a normal method rather than an arrow property, and it no longer consumes the dirty flag for a resize it skipped.
