# Rendering audit — `@jolly-pixel/engine`

Findings from reading the rendering path while diagnosing the voxel-renderer atlas
bleed (2026-08-02). Scope: `src/systems/rendering/*` and `src/components/camera/*`.

Nothing here has been fixed. Each item lists where it is, why it matters, and a
suggested direction.

**Verified** means confirmed at runtime against the `noise-world` example or against
the three.js r185 source in `node_modules`. **Read** means found by inspection only.

| # | Item | Severity | Status |
|---|---|---|---|
| B1 | `Camera3DControls` discards every camera option | High | Verified |
| B2 | Actor transform does not drive cameras | High | Verified |
| B3 | `setProjectionMode` leaves stale references | High | Read |
| B4 | Composer mode breaks with >1 camera | High | Verified |
| B5 | Composer mode ignores `depth` and `viewport` | Medium | Read |
| L1 | Nothing ever disposes the WebGL renderer | High | Verified |
| L2 | `setRenderMode` leaks the previous strategy | Medium | Read |
| L3 | `removeRenderComponent` does not dispose the pass | Low | Read |
| C1 | Renderer creation is entirely hardcoded | High | Verified |
| C2 | `setPixelRatio` is uncapped | Medium | Verified |
| C3 | Shadow maps forced on, at the lowest quality | Medium | Read |
| C4 | `alpha: true` unconditionally | Low | Read |
| C5 | No `powerPreference` | Low | Read |
| C6 | Tone mapping and exposure hardcoded | Medium | Read |
| D1 | `near`/`far` defaults give poor depth precision | Medium | Verified |
| M1–M4 | Minor / hygiene | Low | Read |

---

## Bugs

### B1 — `Camera3DControls` discards every camera option

`src/components/camera/Camera3DControls.ts:41`

```ts
super(actor, {
  addAudioListener: true
});
```

`options` is never forwarded, so `near`, `far`, `fov`, `projectionMode`,
`orthographicScale`, `viewport` and `depth` passed to `Camera3DControls` are silently
ignored — every camera built through it gets `CameraOptions` defaults.

Verified: `packages/voxel-renderer/examples/scripts/demo-noise-world.ts:91` asks for
`far: settings.size * 4` (4096); the live camera reports `far: 10000`.

**Fix:** `super(actor, { ...options, addAudioListener: true })`.

### B2 — Actor transform does not drive cameras

`src/components/camera/Camera.ts:142-153`, and the contract at
`src/systems/rendering/Renderer.ts:38-42` ("sync their THREE.Camera transform from the
actor").

`prepareRender()` copies `actor.object3D.matrixWorld` into `threeCamera.matrixWorld`.
That copy is then thrown away: the `THREE.Camera` is never added to the actor's
`Object3D`, so `camera.parent === null`, and three does

```js
// node_modules/three/src/renderers/WebGLRenderer.js:1639
if ( camera.parent === null && camera.matrixWorldAutoUpdate === true ) camera.updateMatrixWorld();
```

which recomposes `matrixWorld` from the camera's own local position/quaternion/scale
immediately after `prepareRender` ran.

Consequences:

- Moving or parenting the **Actor** has no effect on the camera.
- It only looks like it works because `Camera3DControls` writes straight to
  `this.camera.position` / `.quaternion` (the three camera), bypassing the actor.
- Anything that reasons about the camera through the actor's scene graph is wrong.

Verified: the camera actor's `Object3D` has no children, and the camera is not
reachable from `scene.traverse()`.

**Fix:** pick one model and make it the real one — either add `threeCamera` as a child
of `actor.object3D` and let three drive it, or keep the manual copy and set
`threeCamera.matrixWorldAutoUpdate = false` in the constructor so three stops
overwriting it. The second is the smaller change and matches the documented contract.

### B3 — `setProjectionMode` leaves stale references

`src/components/camera/Camera.ts:241-255` replaces `#threeCamera` with a fresh
instance and nothing else. Three things break:

1. The `THREE.AudioListener` attached in the constructor (`Camera.ts:129-131`) stays on
   the discarded camera — positional audio silently stops tracking the listener.
2. In composer mode, the `RenderPass` built by `addRenderComponent`
   (`ThreeRenderer.ts:74-79`) still holds the old camera, so rendering keeps using the
   previous projection.
3. `removeRenderComponent` finds its pass with `pass.camera === component.threeCamera`
   (`ThreeRenderer.ts:93`). After a projection swap that comparison never matches, so
   the pass is never removed — a leak on top of the stale render.

**Fix:** move the listener across, and notify the renderer so it can rebuild/rebind the
pass (or key passes by component rather than by camera identity).

### B4 — Composer mode breaks with more than one camera

`src/systems/rendering/ThreeRenderer.ts:74-79` and `112-116` add one `RenderPass` per
render component. `RenderPass.clear` defaults to `true`
(`node_modules/three/examples/jsm/postprocessing/RenderPass.js:79`), so each pass wipes
the previous one's output — only the last camera is visible.

**Fix:** `clear = false` on every pass after the first, and `clearDepth = true` for
overlay cameras (which is what `DirectRenderStrategy` effectively achieves via
`autoClear = false` plus a single explicit `clear()`).

### B5 — Composer mode ignores `depth` and `viewport`

`src/systems/rendering/RenderStrategy.ts:102-123`.

`DirectRenderStrategy` sorts components by `depth` and applies per-camera
viewport/scissor rects (`RenderStrategy.ts:48-79`). `ComposerRenderStrategy` does
neither — it just calls `composer.render()`. Split-screen and layered UI cameras work
in direct mode and silently do not in composer mode, with no warning.

**Fix:** at minimum document the limitation; better, honour `depth` in pass ordering and
apply viewports on the passes.

---

## Leaks and lifecycle

### L1 — Nothing ever disposes the WebGL renderer

There is no `dispose()` on `ThreeRenderer`, none on the `Renderer` interface
(`src/systems/rendering/Renderer.ts:58-93`), and `World` has no teardown method at all.
`webGLRenderer.dispose()` appears nowhere in `src/`.

Every `World` an editor creates and drops leaks a GL context, its programs and its
textures. Browsers cap live WebGL contexts (~16 in Chrome), after which context
creation starts failing — so a long editor session that opens and closes scenes will
eventually stop rendering.

**Fix:** add `dispose()` to the `Renderer` interface and implement it
(`webGLRenderer.dispose()`, `unobserveResize()`, dispose the composer), then call it
from a `World` teardown path.

### L2 — `setRenderMode` leaks the previous strategy

`src/systems/rendering/ThreeRenderer.ts:101-133` overwrites `this.renderStrategy`
without disposing what was there. Leaving composer mode drops an `EffectComposer` and
its two full-size render targets on the floor; re-entering it allocates new ones.

### L3 — `removeRenderComponent` does not dispose the removed pass

`src/systems/rendering/ThreeRenderer.ts:82-99` removes the pass from the composer but
never calls `pass.dispose()`.

---

## Renderer configuration

All of the following live in `createWebGLRenderer`, `src/systems/rendering/ThreeRenderer.ts:264-283`:

```ts
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.BasicShadowMap;
renderer.autoClear = false;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.25;
```

### C1 — Renderer creation is entirely hardcoded

`ThreeRendererOptions` exposes only `renderMode` and `sceneManager`. Nothing about the
GL context or the renderer's global state can be chosen by a game.

`antialias` is the pressing one: it can only be set at context creation, so there is
currently **no way at all** to turn MSAA off. That matters beyond taste — MSAA shades
partially covered pixels at the pixel centre, which extrapolates UV varyings outside
the triangle and is exactly what produced the voxel-renderer atlas-bleed artefacts
(white speckles, dark moiré) at distance. A pixel-art or voxel project may reasonably
want it off, and once geometry is sub-pixel MSAA buys very little anyway.

**Fix:** a `ThreeRendererOptions.webgl?: THREE.WebGLRendererParameters` passthrough plus
options for the post-construction settings below.

### C2 — `setPixelRatio` is uncapped

Line 273 uses `window.devicePixelRatio` raw. On a 3× DPR display that is 9× the
fragments.

The cap already exists — `packages/runtime/src/utils/getDevicePixelRatio.ts`, applied at
`packages/runtime/src/index.ts:91` — but only after `loadRuntime` awaits an async
GPU-tier probe, and never at all for consumers using the engine without the runtime.
The policy is in the wrong layer.

**Fix:** cap in the renderer (`Math.min(devicePixelRatio, 2)` as the default) and let the
runtime override it.

### C3 — Shadow maps forced on, at the lowest quality

Lines 274-275 enable `shadowMap` unconditionally and select `BasicShadowMap` — the
lowest-quality type, hard-edged with no PCF filtering. Nothing in the engine asks for
this, and no example casts shadows.

**Fix:** make it opt-in; if shadows are a supported feature, default to
`PCFSoftShadowMap`.

### C4 — `alpha: true` unconditionally

Line 270 forces an alpha channel and composites the canvas against the page. Scenes
that set `scene.background` (all current examples) do not need it, and it costs
bandwidth plus a blend.

### C5 — No `powerPreference`

On hybrid-GPU laptops Chrome may hand back the integrated GPU. `powerPreference:
"high-performance"` is the usual default for a game engine.

### C6 — Tone mapping and exposure hardcoded

Lines 279-280 pin `NeutralToneMapping` with `toneMappingExposure = 1.25`. Combined with
the light intensities the examples use, this clips bright surfaces to pure white — the
noise-world snow tile renders as flat `#ffffff`. Games should be able to choose their
tone-mapping curve and exposure.

---

## Depth precision

### D1 — `near`/`far` defaults

`src/components/camera/Camera.ts:110-111` default to `near = 0.1`, `far = 10000` — a
100,000:1 ratio. With a 24-bit depth buffer, resolution at distance `z` is roughly
`z² × (1/near) / 2²⁴`: about **0.6 world units at 1000 units out, and 1.3 at 1500**.
Any two surfaces closer together than that z-fight.

For reference this was *ruled out* as the cause of the voxel artefacts — raising `near`
to 8 produced pixel-identical output — but it is a real hazard for large worlds, and
`Camera3DControls` users cannot currently change it at all (see B1).

**Fix:** a larger default `near` (0.5–1 is safe for metre-scale worlds), and expose
`logarithmicDepthBuffer` through the options added in C1.

---

## Minor / hygiene

- **M1** — `src/systems/rendering/RenderStrategy.ts:48` copies and sorts the render
  component array on every frame: `[...renderComponents].sort(...)`. Sort on mutation
  instead, or keep a cached sorted view.
- **M2** — `src/systems/rendering/ThreeRenderer.ts:139` uses `console.warn` rather than
  the engine logger.
- **M3** — `src/systems/rendering/ThreeRenderer.ts:217` declares `resize` as an arrow
  function property while every other member is a prototype method. It cannot be
  overridden by a subclass, and it is inconsistent with the rest of the class.
- **M4** — `src/systems/rendering/ThreeRenderer.ts:221-227` clears `#resizeDirty` *before*
  the zero-size early return, consuming the flag for a resize that never happened.
  Harmless today (the `ResizeObserver` sets it again) but fragile.

---

## Suggested order

1. **B1** — one line, unblocks camera configuration entirely.
2. **C1** — the options passthrough; **B1**, **C2**–**C6** and **D1** all become
   configurable once it exists.
3. **L1** — add `dispose()` before the editor grows more scene-swapping.
4. **B2** — decide the camera-transform model and make it real.
5. **B4**, **B5**, **B3** — only if composer mode or runtime projection switching are
   actually used; both are currently broken in ways nobody has hit yet.
6. The rest as cleanup.
