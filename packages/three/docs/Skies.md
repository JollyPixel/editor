# Skies

Three TSL background nodes for an editor viewport: a neutral studio gradient and two outdoor skies. Each class builds its node once in the constructor and exposes it as `node`. They require `THREE.WebGPURenderer`.

```ts
import { DaySky, StudioSky } from "@jolly-pixel/three";

scene.background = null;
scene.backgroundNode = new StudioSky("dark").node;

const sunDirection = new THREE.Vector3(-0.62, 0.55, 0.56).normalize();
scene.backgroundNode = new DaySky(sunDirection).node;
```

The node colors a direction from the camera, so the sky follows the view without any geometry. Constructor arguments are baked into the shader: build a new instance for another theme or direction, and cache the nodes you switch between to avoid recompiling.

## Types

```ts
type SkyBackdrop = "dark" | "light";

interface SkyConstructor {
  readonly backdrop: SkyBackdrop;
  new (direction: THREE.Vector3): { readonly node: THREE.Node; };
}
```

`DaySky` and `NightSky` both satisfy `SkyConstructor`, so a lighting preset can hold either one and build it from its light direction.

## StudioSky

```ts
new StudioSky(backdrop: SkyBackdrop)
```

A horizon to zenith gradient above a flat ground tone, in a dark or a light palette. Pass the page theme to make the viewport match the interface.

## DaySky

```ts
new DaySky(sunDirection: THREE.Vector3)
```

A warm horizon fading to blue, with a soft glow around `sunDirection`, a unit vector from the origin toward the sun. `DaySky.backdrop` is `"light"`: the sky reads as a light surface for overlays drawn on top of it.

## NightSky

```ts
new NightSky(moonDirection: THREE.Vector3)
```

A dark blue gradient with procedural stars above the horizon and a moon disc with a halo at `moonDirection`, a unit vector from the origin toward the moon. `NightSky.backdrop` is `"dark"`.
