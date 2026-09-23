# @jolly-pixel/runtime

## 5.2.0

### Minor Changes

- [#765](https://github.com/JollyPixel/editor/pull/765) [`f92e245`](https://github.com/JollyPixel/editor/commit/f92e2453211663158b04606da2008ba25cc35529) Thanks [@fraxken](https://github.com/fraxken)! - Add `Runtime.nextFrame()`/`frames(count)`, `VoxelEngine.whenIdle()`, `projectToClient()` in three,
  and `textureClientPosition()` on the pixel-draw canvas viewport (typed `CanvasViewport`).

- [#748](https://github.com/JollyPixel/editor/pull/748) [`54c361c`](https://github.com/JollyPixel/editor/commit/54c361c02b8f7ddf26cf71e0453f8f224566cffc) Thanks [@fraxken](https://github.com/fraxken)! - Own performance metrics in the runtime: a subsystem describes what it counts
  through the structural `MetricSource`, `runtime.metrics` registers it on one
  recorder, and `mountMetricsPanel()` builds a dockable readout from them.

- [#709](https://github.com/JollyPixel/editor/pull/709) [`3b91a42`](https://github.com/JollyPixel/editor/commit/3b91a42d560941a003b777f57060fe18972dc4c8) Thanks [@fraxken](https://github.com/fraxken)! - Move the camera view helper into the runtime as a `viewHelper` option that follows the lowest-depth camera.
  The engine drops `createViewHelper`, `OrbitFlyCamera` drops its `viewHelper` option, and `Renderer` exposes `renderComponents`.

### Patch Changes

- [#707](https://github.com/JollyPixel/editor/pull/707) [`0bbc913`](https://github.com/JollyPixel/editor/commit/0bbc91316d992bd0e23609df326632efd1cc7d82) Thanks [@fraxken](https://github.com/fraxken)! - Fix double actor destruction, leaked component and listener teardowns, playlists that stopped after one track, squared master volume, `**/a/b` actor paths, and non-looping sprite animations.
  Breaking: components override `onDestroy()` (with `addTeardown()`), `ThreeRenderer.create(canvas, options)` and `draw(scene)` drop `sceneManager`/render modes/`onDraw`, `GlobalAudio` drops observers, and `SpriteRenderer.texture` is an asset reference.
- Updated dependencies [[`9e4b7a1`](https://github.com/JollyPixel/editor/commit/9e4b7a16d5348458027d06eafc68baf51ca4f519), [`f7b4ec2`](https://github.com/JollyPixel/editor/commit/f7b4ec2fea370220bba2d2ca68f0cb570ed80fcf), [`956a942`](https://github.com/JollyPixel/editor/commit/956a942bec3670dc9cb0a9714a3abe2843330688), [`566c46f`](https://github.com/JollyPixel/editor/commit/566c46f6a0ecab46dd1950f747a1fdb3e764d46a), [`0bbc913`](https://github.com/JollyPixel/editor/commit/0bbc91316d992bd0e23609df326632efd1cc7d82), [`60d0df3`](https://github.com/JollyPixel/editor/commit/60d0df3699f65c5dc38bff6a2458db1c2f05bee0), [`267f172`](https://github.com/JollyPixel/editor/commit/267f172136cd77d1b16b67e3734ff068b65d2fb0), [`54c361c`](https://github.com/JollyPixel/editor/commit/54c361c02b8f7ddf26cf71e0453f8f224566cffc), [`3b91a42`](https://github.com/JollyPixel/editor/commit/3b91a42d560941a003b777f57060fe18972dc4c8), [`94c4da8`](https://github.com/JollyPixel/editor/commit/94c4da893f24adfbf59d1031d3c3731c9b4ff567), [`d6e1b5a`](https://github.com/JollyPixel/editor/commit/d6e1b5a976b4571d78051502df570e85d5b50cce), [`2bb278b`](https://github.com/JollyPixel/editor/commit/2bb278b095453aa8bf1e66c4d5fb36b98a9647cb), [`4ae4d68`](https://github.com/JollyPixel/editor/commit/4ae4d683df8328d306023260732c1efc787acd98)]:
  - @jolly-pixel/asset@2.1.0
  - @jolly-pixel/ui@3.1.0
  - @jolly-pixel/engine@6.0.0
  - @jolly-pixel/loop@1.0.0

## 5.1.0

### Minor Changes

- [#683](https://github.com/JollyPixel/editor/pull/683) [`537b8b6`](https://github.com/JollyPixel/editor/commit/537b8b6cc297309d8bfadca2ae4189483e517dde) Thanks [@fraxken](https://github.com/fraxken)! - Add `runtime.overlay` and the `overlay.container` option: the performance HUD and focus hint now follow the canvas instead of the window corner.
  The HUD accepts all nine anchor positions and an `inset`, and the focus hint no longer sets a `z-index` that put it above dialogs and floating panes.

### Patch Changes

- [#699](https://github.com/JollyPixel/editor/pull/699) [`9f5cb54`](https://github.com/JollyPixel/editor/commit/9f5cb5412ba47200793de247e3de53e21e8b7ec4) Thanks [@fraxken](https://github.com/fraxken)! - Update three.js to 0.186.0.
  `disposeObject3D` now ignores the base `Object3D.dispose` added in 0.186, so a plain mesh's geometry and material are freed again.
  `snapValue` normalizes a negative zero result to positive zero.
- Updated dependencies [[`60bef9d`](https://github.com/JollyPixel/editor/commit/60bef9d4d51f63a269e31f26d1817399708f8b6a), [`ab65462`](https://github.com/JollyPixel/editor/commit/ab65462597390541cdb2bee98a7aa22dff562c69), [`2fbcaeb`](https://github.com/JollyPixel/editor/commit/2fbcaeb78ac80e4ce706ae66c2c6203513d439c4), [`bd77308`](https://github.com/JollyPixel/editor/commit/bd773087b83d357491bd56e0e3d60808f2ee5434), [`bb3e894`](https://github.com/JollyPixel/editor/commit/bb3e89489f37e83b2435b3d41fa208e2e53aa3ad), [`b91d177`](https://github.com/JollyPixel/editor/commit/b91d1777197a160daafd69ed4857ff9ea3c999c4), [`81f9fcc`](https://github.com/JollyPixel/editor/commit/81f9fcc003a62bb102e5f0cfb4cf439165778ccf), [`271fba9`](https://github.com/JollyPixel/editor/commit/271fba955fe79253b972a13daf0419a696138788), [`bd77308`](https://github.com/JollyPixel/editor/commit/bd773087b83d357491bd56e0e3d60808f2ee5434), [`d8f9e21`](https://github.com/JollyPixel/editor/commit/d8f9e21ba3dfb92135c83f909e542b8cbe668fa7), [`c9c7379`](https://github.com/JollyPixel/editor/commit/c9c7379f0e9e1255eb1fb8f88bc660fec32c249a), [`60bef9d`](https://github.com/JollyPixel/editor/commit/60bef9d4d51f63a269e31f26d1817399708f8b6a), [`9f5cb54`](https://github.com/JollyPixel/editor/commit/9f5cb5412ba47200793de247e3de53e21e8b7ec4), [`1e16c34`](https://github.com/JollyPixel/editor/commit/1e16c343d63da08745ad1fdeb12c3dd83364e573), [`3b06ff8`](https://github.com/JollyPixel/editor/commit/3b06ff841b592848f538af79b60b75456d7d5842), [`be5e8bf`](https://github.com/JollyPixel/editor/commit/be5e8bfa64d4a0b17dfac90ab37ec6e9208330d1), [`25fd361`](https://github.com/JollyPixel/editor/commit/25fd361714e6bb55f8fa61f0404d85a055e245f7), [`2371afa`](https://github.com/JollyPixel/editor/commit/2371afaaff5dd986b36c3ea20a101146ec12b795), [`15f358a`](https://github.com/JollyPixel/editor/commit/15f358a223cd8fc57d10b9a800a5b5b2edcb0268), [`c1d08b8`](https://github.com/JollyPixel/editor/commit/c1d08b8ee5c6d196172c623b0906b10d1061ab40), [`73b40f6`](https://github.com/JollyPixel/editor/commit/73b40f63553c35fbda9fcd6cc6ed472a63cabebb), [`6895753`](https://github.com/JollyPixel/editor/commit/6895753c6e09c43758357ee5997b981ce5c401ac)]:
  - @jolly-pixel/ui@3.0.0
  - @jolly-pixel/engine@5.1.0
  - @jolly-pixel/asset@2.0.0
  - @jolly-pixel/loop@1.0.0

## 5.0.0

### Major Changes

- [#516](https://github.com/JollyPixel/editor/pull/516) [`66ee3e0`](https://github.com/JollyPixel/editor/commit/66ee3e0740bcf6ec96a507ad47c9d565a9750a48) Thanks [@fraxken](https://github.com/fraxken)! - Implement a new loop engine/workspace

- [#626](https://github.com/JollyPixel/editor/pull/626) [`d9a6038`](https://github.com/JollyPixel/editor/commit/d9a603815146600e435493f5c316c564d85fa9da) Thanks [@fraxken](https://github.com/fraxken)! - Move startup loading to `Runtime.load()` and remove the standalone `loadRuntime`
  and `resolveRuntimeCanvas` exports. Rename `LoadRuntimeOptions` to
  `RuntimeLoadOptions`.

### Minor Changes

- [#521](https://github.com/JollyPixel/editor/pull/521) [`02bc332`](https://github.com/JollyPixel/editor/commit/02bc3329e46bf536727ad696140dc7d09ccccb92) Thanks [@fraxken](https://github.com/fraxken)! - Refactor voxel-map editor to use @jolly-pixel/ui components (+ diverses bug fixes)

- [#529](https://github.com/JollyPixel/editor/pull/529) [`2db69a8`](https://github.com/JollyPixel/editor/commit/2db69a870c0ef3f5375c53cf2661ef23d43584a4) Thanks [@fraxken](https://github.com/fraxken)! - Add `Mouse.scroll` for signed wheel magnitude and keep drags alive once the
  cursor leaves the canvas. `Runtime.load()`/`configureRuntimeDevice` accept
  `maxFps` to override the GPU-benchmarked render cap.

- [#626](https://github.com/JollyPixel/editor/pull/626) [`0bb2043`](https://github.com/JollyPixel/editor/commit/0bb20431dccea174bd9ffc43e720963ce07efae0) Thanks [@fraxken](https://github.com/fraxken)! - Add a `focusHint` runtime option that overlays a translucent "Click to focus"
  label on the canvas while it does not hold keyboard focus. Disabled by default,
  freely anchored among nine positions with a configurable inset and text.

- [#489](https://github.com/JollyPixel/editor/pull/489) [`e83c39b`](https://github.com/JollyPixel/editor/commit/e83c39bdc271493400eecce3acd9b6568262f845) Thanks [@fraxken](https://github.com/fraxken)! - Move input controls inside the new @jolly-pixel/controls package (workspace)

- [#487](https://github.com/JollyPixel/editor/pull/487) [`71953e5`](https://github.com/JollyPixel/editor/commit/71953e5e7d63eddb44702d8ab8897536e27b363f) Thanks [@fraxken](https://github.com/fraxken)! - Add the DOM-free `StatsRecorder` API and the themeable, cycling `jolly-stats` performance HUD. Replace stats.js with the JollyPixel recorder and HUD, with optional mounting and top-corner placement.

- [#497](https://github.com/JollyPixel/editor/pull/497) [`09c6b49`](https://github.com/JollyPixel/editor/commit/09c6b49ef18895cfccc2d30b4c250e56fdeaeff7) Thanks [@fraxken](https://github.com/fraxken)! - Add a new option to skip entirely the loading screen

- [#558](https://github.com/JollyPixel/editor/pull/558) [`d177aad`](https://github.com/JollyPixel/editor/commit/d177aad67d137804b3599a16a62554a6d18c0c27) Thanks [@fraxken](https://github.com/fraxken)! - `Runtime.create()` now accepts a CSS selector in addition to an
  `HTMLCanvasElement`, removing the manual `document.querySelector` and
  null-check boilerplate from every call site.

- [#486](https://github.com/JollyPixel/editor/pull/486) [`d89455e`](https://github.com/JollyPixel/editor/commit/d89455e2093dd644ee67debadd0d7177857a6a59) Thanks [@fraxken](https://github.com/fraxken)! - Implement <jolly-progress> and <jolly-loading> inside UI and use them in runtime

### Patch Changes

- Updated dependencies [[`d9e0b8a`](https://github.com/JollyPixel/editor/commit/d9e0b8aa2edec5a0dc77f16d676e7daeb93be117), [`939ac02`](https://github.com/JollyPixel/editor/commit/939ac022b35ae9cf5e0e1d3210731cee8fcbc32d), [`02bc332`](https://github.com/JollyPixel/editor/commit/02bc3329e46bf536727ad696140dc7d09ccccb92), [`66ee3e0`](https://github.com/JollyPixel/editor/commit/66ee3e0740bcf6ec96a507ad47c9d565a9750a48), [`014dbb0`](https://github.com/JollyPixel/editor/commit/014dbb0f4d5be9e3df8caefbbab47365f8a7fbf5), [`db58ed4`](https://github.com/JollyPixel/editor/commit/db58ed4f87cd137eb7e3a0470e75febcbad5034b), [`18842ab`](https://github.com/JollyPixel/editor/commit/18842abe5ad347f63eacf8254d0685cba235adee), [`72b75c0`](https://github.com/JollyPixel/editor/commit/72b75c0e550e1dc261d9f86a6864b29e91cc3b8e), [`b4a7046`](https://github.com/JollyPixel/editor/commit/b4a704691b17dfec6cafc637c757c937913632b4), [`cf4816d`](https://github.com/JollyPixel/editor/commit/cf4816dc112090f4b0e90d9c417e4817a8b2f956), [`4618512`](https://github.com/JollyPixel/editor/commit/46185125cdefbcc0dd821c82612afc13e2696aec), [`e83c39b`](https://github.com/JollyPixel/editor/commit/e83c39bdc271493400eecce3acd9b6568262f845), [`3bde59b`](https://github.com/JollyPixel/editor/commit/3bde59b0a25d61653b3200849c64bf93c3d30c8d), [`981f340`](https://github.com/JollyPixel/editor/commit/981f340f5933b21508a8b5acca991c8e44b451d0), [`71953e5`](https://github.com/JollyPixel/editor/commit/71953e5e7d63eddb44702d8ab8897536e27b363f), [`2391a21`](https://github.com/JollyPixel/editor/commit/2391a213543812f357d99f25d3a7ba58e33a57f2), [`9b87bfe`](https://github.com/JollyPixel/editor/commit/9b87bfe6de642aaf3ea9d25a09dd3b022bb8f8dc), [`19e1012`](https://github.com/JollyPixel/editor/commit/19e1012fa8b3260b38212a462a62addba8f1b5de), [`c5e4f38`](https://github.com/JollyPixel/editor/commit/c5e4f38bafbc56cfba7a5de5d5f66e3ed1cf6f65), [`33cba8e`](https://github.com/JollyPixel/editor/commit/33cba8e750bdd4cac96f409c3cf310159f73ad20), [`8cce611`](https://github.com/JollyPixel/editor/commit/8cce611bbaa0b9e393834fc373b8aac81ae7f04f), [`a0f07ca`](https://github.com/JollyPixel/editor/commit/a0f07ca1f5d8ba66dd4819688602b51942036c1b), [`cd04886`](https://github.com/JollyPixel/editor/commit/cd048869b91af6a09ff56c73b8701b47fc13d78e), [`a9a6ca8`](https://github.com/JollyPixel/editor/commit/a9a6ca8279097ff6e64a800f797a96ab21597e1b), [`82ce3e8`](https://github.com/JollyPixel/editor/commit/82ce3e8139f436f25676c1b7bcd8447e1b4db416), [`3bde59b`](https://github.com/JollyPixel/editor/commit/3bde59b0a25d61653b3200849c64bf93c3d30c8d), [`e55decb`](https://github.com/JollyPixel/editor/commit/e55decba8f0dbc35f1351ea3218360de0b5dbfc1), [`b4a7046`](https://github.com/JollyPixel/editor/commit/b4a704691b17dfec6cafc637c757c937913632b4), [`245bc85`](https://github.com/JollyPixel/editor/commit/245bc850a6f0798459b2e829ad99add3e0510c54), [`cd200eb`](https://github.com/JollyPixel/editor/commit/cd200ebf5440b27cecc74221104deae7e7bf9be6), [`eec5e52`](https://github.com/JollyPixel/editor/commit/eec5e52f462e33212e05f474e9ed44aee5a33a82), [`bf18d36`](https://github.com/JollyPixel/editor/commit/bf18d36840b7be32ca239b865c7a21dab0510afb), [`444fba8`](https://github.com/JollyPixel/editor/commit/444fba8abd23c4407f84e3110c53fec1f3710496), [`ac50655`](https://github.com/JollyPixel/editor/commit/ac50655063011ff4f1ec7bddd78a95ef77fd6f56), [`d89455e`](https://github.com/JollyPixel/editor/commit/d89455e2093dd644ee67debadd0d7177857a6a59), [`578fded`](https://github.com/JollyPixel/editor/commit/578fded23cd3e7a81b9a80d20f9571244398e633)]:
  - @jolly-pixel/ui@2.0.0
  - @jolly-pixel/engine@5.0.0
  - @jolly-pixel/asset@1.1.0

## 4.0.0

### Major Changes

- [#445](https://github.com/JollyPixel/editor/pull/445) [`cd85d69`](https://github.com/JollyPixel/editor/commit/cd85d697ec3cbe8f25e4edd0c531016d0c371d9c) Thanks [@fraxken](https://github.com/fraxken)! - Runtime built-in SVG icon, custom parentContainer, custom CSS with ShadowDOM

- [#411](https://github.com/JollyPixel/editor/pull/411) [`10fef00`](https://github.com/JollyPixel/editor/commit/10fef008eae61e8b8cb163a80c66c82ae68ab98e) Thanks [@fraxken](https://github.com/fraxken)! - Switch the rendering pipeline from `THREE.WebGLRenderer` to `THREE.WebGPURenderer` (`three/webgpu`), which renders natively on WebGPU and automatically falls back to a WebGL2 backend when WebGPU isn't available.

### Minor Changes

- [#377](https://github.com/JollyPixel/editor/pull/377) [`6dd2fc7`](https://github.com/JollyPixel/editor/commit/6dd2fc79cf5711b8b99e1fc85e0e8471ed8b7f31) Thanks [@fraxken](https://github.com/fraxken)! - Fix the rendering path issues found in the `RENDERING-AUDIT.md` review.

  **Cameras are now driven by their actor.** `CameraComponent` sets `matrixWorldAutoUpdate = false` on its `THREE.Camera`, so the transform `prepareRender` copies from `actor.object3D` survives instead of being recomposed by three right before the draw. Moving or parenting the actor now moves the camera, as the `Renderer` contract always claimed.

  _Breaking:_ writes to `component.camera.position` / `.quaternion` / `.rotation` no longer have any effect — they are overwritten every frame. Move the camera through `actor.transform` instead:

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

### Patch Changes

- Updated dependencies [[`7f4df3f`](https://github.com/JollyPixel/editor/commit/7f4df3f69d15899a991e874e3c85ec1c8a70d29d), [`6dd2fc7`](https://github.com/JollyPixel/editor/commit/6dd2fc79cf5711b8b99e1fc85e0e8471ed8b7f31), [`feaf15c`](https://github.com/JollyPixel/editor/commit/feaf15c26a42e6099994de0fee452f0350dececf), [`10fef00`](https://github.com/JollyPixel/editor/commit/10fef008eae61e8b8cb163a80c66c82ae68ab98e)]:
  - @jolly-pixel/engine@4.0.0

## 3.4.0

### Minor Changes

- [#310](https://github.com/JollyPixel/editor/pull/310) [`6447779`](https://github.com/JollyPixel/editor/commit/64477791f5dae06af2f420d61d872c3c2d97103e) Thanks [@fraxken](https://github.com/fraxken)! - Expose TMJ loading as a plugins in voxel.renderer and fix the TMJ example by preloading scene assets in engine and runtime

- [#246](https://github.com/JollyPixel/editor/pull/246) [`a2ce2a2`](https://github.com/JollyPixel/editor/commit/a2ce2a2fd6fc536de358b0d5ad966cd53882245c) Thanks [@fraxken](https://github.com/fraxken)! - Major refactor of AssetManager and loaders

### Patch Changes

- [#297](https://github.com/JollyPixel/editor/pull/297) [`0ac82f3`](https://github.com/JollyPixel/editor/commit/0ac82f3532ceae21b62421cf15dc60eeb4bd26c8) Thanks [@fraxken](https://github.com/fraxken)! - Bump the `three` peer dependency from `0.182.0` to `^0.185.1` to match the rest of the monorepo. The mismatched pin caused npm to install two separate copies of three.js, which broke `WebGLRenderer.renderBufferDirect` (`object.matrixWorld.determinantAffine is not a function`) whenever objects built by the engine's copy of three were rendered through a renderer/helper (e.g. `ViewHelper`) created from the other copy.

- Updated dependencies [[`6447779`](https://github.com/JollyPixel/editor/commit/64477791f5dae06af2f420d61d872c3c2d97103e), [`a9e412a`](https://github.com/JollyPixel/editor/commit/a9e412a6933a84fbecf390483ea35c857acec926), [`a2ce2a2`](https://github.com/JollyPixel/editor/commit/a2ce2a2fd6fc536de358b0d5ad966cd53882245c), [`4d22d1a`](https://github.com/JollyPixel/editor/commit/4d22d1aadb71a087b1d7472924d5dfabbb05fe77), [`3380d96`](https://github.com/JollyPixel/editor/commit/3380d968dbad604dffa68eebc947e1f75919f9ef), [`0ac82f3`](https://github.com/JollyPixel/editor/commit/0ac82f3532ceae21b62421cf15dc60eeb4bd26c8), [`0d913de`](https://github.com/JollyPixel/editor/commit/0d913de782055a6636b441a66f9c59461f343b3c)]:
  - @jolly-pixel/engine@3.0.0

## 3.3.0

### Minor Changes

- [#236](https://github.com/JollyPixel/editor/pull/236) [`dfff053`](https://github.com/JollyPixel/editor/commit/dfff05301b97c739b264b74515bb25f4ff3fbf38) Thanks [@fraxken](https://github.com/fraxken)! - Add a focusCanvas to disable permanent canvas focus listener

## 3.2.0

### Minor Changes

- [#175](https://github.com/JollyPixel/editor/pull/175) [`f50efc5`](https://github.com/JollyPixel/editor/commit/f50efc5a4962203a136f9bc5e604f9535ef0c11e) Thanks [@fraxken](https://github.com/fraxken)! - Enhance and fix bugs with Asset Management

### Patch Changes

- Updated dependencies [[`f50efc5`](https://github.com/JollyPixel/editor/commit/f50efc5a4962203a136f9bc5e604f9535ef0c11e), [`f48549e`](https://github.com/JollyPixel/editor/commit/f48549e90658b774a6913bbf8630c358630121ed)]:
  - @jolly-pixel/engine@2.2.0

## 3.1.0

### Minor Changes

- [#168](https://github.com/JollyPixel/editor/pull/168) [`dd4d9c6`](https://github.com/JollyPixel/editor/commit/dd4d9c6d51048e2debd5c6fbe279dbfc5dd2cb86) Thanks [@fraxken](https://github.com/fraxken)! - Re-implement part of the game loop into World and expose hooks as EE

- [#162](https://github.com/JollyPixel/editor/pull/162) [`2a3261b`](https://github.com/JollyPixel/editor/commit/2a3261b5d7516a3e7e2cfe8612c8e214f4b029ac) Thanks [@fraxken](https://github.com/fraxken)! - Implement fixedUpdate lifecycle and enhance component with needUpdate

### Patch Changes

- [#159](https://github.com/JollyPixel/editor/pull/159) [`fb3e1b5`](https://github.com/JollyPixel/editor/commit/fb3e1b50ef7e7976c3411593ac3ba58168eb1f29) Thanks [@fraxken](https://github.com/fraxken)! - Fix loadRuntime so error throw in world.connect() can escalate the stack

- Updated dependencies [[`70f1b3b`](https://github.com/JollyPixel/editor/commit/70f1b3beefec61d38a8c0d1b617dd549540f406d), [`dd4d9c6`](https://github.com/JollyPixel/editor/commit/dd4d9c6d51048e2debd5c6fbe279dbfc5dd2cb86), [`2a3261b`](https://github.com/JollyPixel/editor/commit/2a3261b5d7516a3e7e2cfe8612c8e214f4b029ac), [`519f4f1`](https://github.com/JollyPixel/editor/commit/519f4f1c4b03373fce674b009ac48dc9a4ff4692)]:
  - @jolly-pixel/engine@2.1.0

## 3.0.0

### Major Changes

- [#157](https://github.com/JollyPixel/editor/pull/157) [`c3ca721`](https://github.com/JollyPixel/editor/commit/c3ca72107b76c40e6cb81785883c82b01ffc0a02) Thanks [@fraxken](https://github.com/fraxken)! - Major refactoring of ECS APIs (GameInstance -> World, Actor and ActorComponent breaking, SceneEngine -> SceneManager, new Transform APIs, etc)

### Patch Changes

- [#155](https://github.com/JollyPixel/editor/pull/155) [`c8405ca`](https://github.com/JollyPixel/editor/commit/c8405caba754802a9fdd5851411fa5af492c4e4b) Thanks [@fraxken](https://github.com/fraxken)! - Fix some mistake with newest GameInstance TContext generic and add a type GameInstanceDefaultContext to avoid repeting the default type everywhere

- Updated dependencies [[`c8405ca`](https://github.com/JollyPixel/editor/commit/c8405caba754802a9fdd5851411fa5af492c4e4b), [`c3ca721`](https://github.com/JollyPixel/editor/commit/c3ca72107b76c40e6cb81785883c82b01ffc0a02)]:
  - @jolly-pixel/engine@2.0.0

## 2.0.0

### Major Changes

- [#152](https://github.com/JollyPixel/editor/pull/152) [`ca274cf`](https://github.com/JollyPixel/editor/commit/ca274cf06e148676cfb30a129f19decfb1eed910) Thanks [@fraxken](https://github.com/fraxken)! - Rename Player to Runtime and introduce World context

### Minor Changes

- [#153](https://github.com/JollyPixel/editor/pull/153) [`06693b6`](https://github.com/JollyPixel/editor/commit/06693b6ffa77fc957c615df41d19f110fa8b5735) Thanks [@fraxken](https://github.com/fraxken)! - Configure three as peerDependencies

### Patch Changes

- Updated dependencies [[`06693b6`](https://github.com/JollyPixel/editor/commit/06693b6ffa77fc957c615df41d19f110fa8b5735), [`64a510e`](https://github.com/JollyPixel/editor/commit/64a510e4e1fd094958c20d03c9386115e8fad6ca), [`2bc5859`](https://github.com/JollyPixel/editor/commit/2bc5859c82e2118b1f49b1adaedba651a2490910), [`b8b2b30`](https://github.com/JollyPixel/editor/commit/b8b2b305291248fcdd786ea70809e6f2c73a4778), [`3668c6e`](https://github.com/JollyPixel/editor/commit/3668c6e9b48655a1138371684e2798e40b3e14f5)]:
  - @jolly-pixel/engine@1.3.0

## 1.1.0

### Minor Changes

- [#138](https://github.com/JollyPixel/editor/pull/138) [`8fd03e9`](https://github.com/JollyPixel/editor/commit/8fd03e9f43751bd05852b22af719a1dbfb0d8a8c) Thanks [@fraxken](https://github.com/fraxken)! - Integrate new FixedTimeStep for gameloop with fixedUpdate and classical update

### Patch Changes

- Updated dependencies [[`8fd03e9`](https://github.com/JollyPixel/editor/commit/8fd03e9f43751bd05852b22af719a1dbfb0d8a8c), [`2404b11`](https://github.com/JollyPixel/editor/commit/2404b11df9e57c624d84c2bed0cee7c36f0656c3), [`b080129`](https://github.com/JollyPixel/editor/commit/b080129f877bf61513dc555051d504683f986d76)]:
  - @jolly-pixel/engine@1.2.0
