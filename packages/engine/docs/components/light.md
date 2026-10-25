# LightComponent

Adds a three.js light to an actor. The light sits at the actor's origin;
directional and spot lights aim along the actor's forward axis (local `-Z`),
so rotating the actor aims the light.

```ts
import * as THREE from "three";
import { Actor, LightComponent } from "@jolly-pixel/engine";

const sun = new Actor(world, { name: "Sun" });
sun.transform.lookAt(new THREE.Vector3(0, -1, -1));
sun.addComponent(LightComponent, {
  kind: "directional",
  intensity: 2,
  castShadow: true
});
```

## Options

```ts
interface LightOptions {
  kind?: "ambient" | "hemisphere" | "directional" | "point" | "spot"; // "directional"
  color?: THREE.ColorRepresentation; // "#ffffff", sky color of a hemisphere light
  groundColor?: THREE.ColorRepresentation; // "#444444", hemisphere only
  intensity?: number; // 1
  distance?: number; // 0 (no limit), point and spot
  decay?: number; // 2, point and spot
  angle?: number; // 60, spot cone angle in degrees
  penumbra?: number; // 0, in [0, 1], spot
  castShadow?: boolean; // false, ignored by ambient and hemisphere
  shadowMapSize?: number; // 1024 texels per side
  shadowBias?: number; // 0
}
```

`LIGHT_DEFAULTS` holds these defaults. Shadows also need the renderer's
shadow map enabled.

## Properties

```ts
class LightComponent {
  readonly threeLight: THREE.Light;
  readonly kind: LightKind;
}
```

## Methods

### configure(options): this

Merges `options` into the current settings and writes them to the live light.
A new `kind` replaces `threeLight` with a light of that kind and disposes the
previous one. A new `shadowMapSize` releases the shadow map so it is
reallocated at the new size.

## See also

- [Scene files](../systems/scene-file.md#built-in-definitions): the `Light`
  definition
