# Environment

An environment is the look a scene renders in: sky, sun, ambient light, reflections, fog, tone mapping, glow and voxel shading. Games and editors describe it with one `EnvironmentFile` and apply it with one `SceneEnvironment`, so a scene looks the same in an editor viewport and in the game.

```ts
import { Systems } from "@jolly-pixel/engine";

const environment = world.sceneManager.graph.createEnvironment(world);
environment.apply(Systems.ENVIRONMENT_PRESETS.day);
```

A [scene file](scene-file.md) references an environment asset (kind `environment`) by id, or `null` for the `default` preset.

## File format

```ts
interface EnvironmentFile {
  version: 1;
  sky:
    | { kind: "none"; }
    | { kind: "color"; color: ColorJSON; }
    | { kind: "day"; }
    | { kind: "night"; };
  sun: {
    color: ColorJSON;
    intensity: number;
    azimuth: number; // degrees around +Y, from +Z toward +X
    elevation: number; // degrees above the horizon
  } | null;
  ambient: { skyColor: ColorJSON; groundColor: ColorJSON; intensity: number; };
  reflections: { kind: "none" | "room"; intensity: number; };
  fog:
    | { kind: "none"; }
    | { kind: "linear"; color: ColorJSON; near: number; far: number; }
    | { kind: "exp2"; color: ColorJSON; density: number; };
  toneMapping: { kind: "none" | "neutral" | "aces" | "agx"; exposure: number; };
  glow: { strength: number; radius: number; } | null; // radius from 0 to 1
  voxel: { blockLightFalloff: "wide" | "focused"; shadowFill: number; };
}
```

- `sky` `none` clears to the renderer's clear color. `day` and `night` are procedural skies that place their sun or moon glow along the sun direction.
- `ambient` is a hemisphere light: equal colors give a flat ambient light.
- `voxel` is read by the `VoxelRenderer` component of `@jolly-pixel/voxel.renderer`; other renderers ignore it.
- Lights placed in a scene add to the environment's sun and ambient light.

## Presets

`ENVIRONMENT_PRESETS` holds frozen files by name:

- `default`: no sky, no sun, the room reflections at intensity 1 and neutral tone mapping at exposure 1.25. A scene without an environment renders with it.
- `studio`: a neutral sun and ambient light for previewing assets.
- `day` and `night`: an outdoor sky with a warm sun or a dim moon, ACES Filmic tone mapping. `night` focuses block light and lets it fill shadows.

Copy a preset before changing it: only the top-level object is frozen.

## Asset type

`ENVIRONMENT_ASSET` is the `AssetType<EnvironmentFile>` of kind `environment`. `createDefaultAssetLoaders()` registers `EnvironmentFileAssetLoader` for it, which reads the file as JSON.

## ThreeSceneEnvironment

```ts
class ThreeSceneEnvironment implements SceneEnvironment {
  readonly sun: THREE.DirectionalLight;
  readonly ambient: THREE.HemisphereLight;
  fallbackSky: THREE.Node | null;

  constructor(
    graph: ThreeSceneGraph,
    world: World,
    options?: { room?: BakedRoomEnvironment | null; }
  );

  apply(file: Readonly<EnvironmentFile>): void;
  copySunDirectionTo(target: THREE.Vector3): THREE.Vector3;
  aimSun(center?: THREE.Vector3Like, distance?: number): void;
  dispose(): void;
}
```

`graph.createEnvironment(world)` returns one without a loaded room map.

- The constructor adds `sun`, its target and `ambient` to the graph's scene, both at intensity 0. They stay in the scene for the environment's lifetime, so applying a file never adds or removes a light.
- `apply(file)` sets the sky, lights, fog, reflections, the renderer's tone mapping and exposure, and the graph's `postProcessing` for `glow`. It also stores the file in `graph.environment`.
- `fallbackSky` is the background node drawn while the applied sky is `none`, and `null` (the default) clears to the renderer's clear color. Setting it takes effect at once. Editors use it for a backdrop that follows their theme.
- The `day` and `night` skies read the sun direction through a uniform: moving the sun keeps the same sky node and shader.
- The `room` reflections use [BakedRoomEnvironment](baked-room-environment.md). Given `options.room`, the map is set during the first `apply`. Otherwise it loads in the background, is set once it arrives and the world is invalidated. A failed load logs a warning. Without a renderer `source`, no map is loaded.
- Changing the glow `strength` or `radius` keeps the same post-processing function, so camera pipelines are not rebuilt.
- `aimSun(center, distance)` places the sun `distance` units from `center` along the sun direction and aims it at `center`. Without arguments it reuses the last ones (the origin and 24 at first). Editors call it to follow the camera with sun shadows.
- `dispose()` removes the lights, clears the sky, fog, reflections, glow and `graph.environment`, and restores the renderer's tone mapping and exposure from before the constructor.

The headless scene graph returns an environment that ignores every call.
