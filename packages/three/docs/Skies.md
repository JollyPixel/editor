# Skies

A TSL background node for an editor viewport: a neutral studio gradient. The class builds its node once in the constructor and exposes it as `node`. It requires `THREE.WebGPURenderer`. Outdoor skies belong to environments, which `@jolly-pixel/engine` applies.

```ts
import { StudioSky } from "@jolly-pixel/three";

scene.background = null;
scene.backgroundNode = new StudioSky("dark").node;
```

The node colors a direction from the camera, so the sky follows the view without any geometry. The backdrop is baked into the shader: build a new instance for the other theme, and cache the nodes you switch between to avoid recompiling.

## Types

```ts
type SkyBackdrop = "dark" | "light";
```

## StudioSky

```ts
new StudioSky(backdrop: SkyBackdrop)
```

A horizon to zenith gradient above a flat ground tone, in a dark or a light palette. Pass the page theme to make the viewport match the interface.
