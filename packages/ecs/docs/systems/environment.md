# Environment

An environment is the look a scene renders in: sky, sun, ambient light, reflections, fog, tone mapping, glow and voxel shading. Games and editors describe it with one `EnvironmentFile` and apply it with the `SceneEnvironment` their scene graph creates, so a scene looks the same in an editor viewport and in the game.

```ts
import { Systems } from "@jolly-pixel/ecs";

const environment = world.sceneManager.graph.createEnvironment(world);
environment.apply(Systems.ENVIRONMENT_PRESETS.day);
```

A [scene file](scene-file.md) references an environment asset (kind `environment`) by id, or `null` for the `default` preset.

`HeadlessSceneGraph` returns an environment that ignores every call.

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

`ENVIRONMENT_ASSET` is the `AssetType<EnvironmentFile>` of kind `environment`. The three.js backend registers a loader for it that reads the file as JSON.
