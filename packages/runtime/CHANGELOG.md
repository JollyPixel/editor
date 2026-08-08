# @jolly-pixel/runtime

## 4.0.0

### Major Changes

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

- Updated dependencies [[`6dd2fc7`](https://github.com/JollyPixel/editor/commit/6dd2fc79cf5711b8b99e1fc85e0e8471ed8b7f31), [`10fef00`](https://github.com/JollyPixel/editor/commit/10fef008eae61e8b8cb163a80c66c82ae68ab98e)]:
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
