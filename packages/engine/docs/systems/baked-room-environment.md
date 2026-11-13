# BakedRoomEnvironment

`BakedRoomEnvironment` loads a prefiltered copy of three.js's `RoomEnvironment` reflection map, so the renderer does not generate it when the page opens.

```ts
import { Systems } from "@jolly-pixel/engine";

const room = await Systems.BakedRoomEnvironment.load();
const target = room.createRenderTarget(renderer);

scene.environment = target.texture;
```

The map is the output of `PMREMGenerator.fromScene(new RoomEnvironment(), 0.04)` into a 64 pixel cube with 4 mip levels, stored as half floats in `roomEnvironment.bin` (261 KB, 58 KB with brotli). Bundlers that handle `new URL(path, import.meta.url)`, such as Vite, emit the file next to the code.

## Methods

### `static load(): Promise<BakedRoomEnvironment>`

Requests the bundled map once and returns the same promise to every later call, including a rejection when the response is not ok. Calling it without awaiting starts the download early and reports no unhandled rejection. The request starts one microtask after the first call, so calling it while a module evaluates does not run `fetch` inside that evaluation.

### `constructor(texels: Uint16Array)`

Wraps half-float RGBA texels ordered by mip level, then cube face, then row. Throws a `RangeError` when their count does not match 6 faces of 64, 32, 16 and 8 pixels.

### `createRenderTarget(renderer): THREE.CubeRenderTarget`

Copies the texels into a new cube render target set up like the one `PMREMGenerator` returns, flagged with `isPMREMTexture`, and returns it.

- The copy is submitted to the GPU queue before the method returns, ahead of any later frame.
- On the WebGL 2 fallback backend, which cannot copy into a cube render target, it generates the same map with `PMREMGenerator` instead.
- `renderer` must be initialized, with `await renderer.init()` or a first render.
- The caller owns the render target and disposes it.

## Baking

`pnpm run bake:environment` regenerates `src/three/rendering/environment/roomEnvironment.bin` in a headed Chromium with WebGPU. It renders a mirror-like object with the generated map and with the copy from `createRenderTarget`, and fails unless both renders are identical.
