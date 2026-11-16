---
"@jolly-pixel/engine": major
"@jolly-pixel/three": major
"@jolly-pixel/voxel.renderer": minor
---

Add shared environments: `EnvironmentFile` (sky, sun, ambient, reflections, fog, tone mapping, glow, voxel shading), `ENVIRONMENT_PRESETS` and the `environment` asset type, applied by `ThreeSceneEnvironment` (with a `fallbackSky` for files without a sky). `SceneFile.environment` is now an environment reference or `null`.
`DaySky` and `NightSky` move from `@jolly-pixel/three` to the engine. `VoxelRenderer` follows the environment's voxel shading, and `VoxelMapSettings` gains `ambientOcclusion`.
