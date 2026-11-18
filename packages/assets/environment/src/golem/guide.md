An `environment` asset (`.environment.json`) is the look a scene renders in: `sky` (`none`, `color`, `day` or `night`), `sun` (a directional light, or `null`), `ambient` (a hemisphere light), `reflections`, `fog` (`none`, `linear` or `exp2`), `toneMapping`, `glow` (bloom on emissive surfaces, or `null`) and `voxel` (block light and shadow fill for voxel maps and models). Several scenes can share one.

- Create one with `catalog_create` and a path ending in `.environment.json`: it starts as the `default` preset, no sky and no sun.
- Change it with the `change` intent. Each section is partial: `{ "fog": { "density": 0.03 } }` keeps the fog's color. Give a section a new `kind` and the missing fields take defaults. `null` turns `sun` or `glow` off. `preset` (`default`, `studio`, `day`, `night`) starts every section from that preset first: `{ "preset": "day", "fog": { "kind": "linear", "far": 120 } }`.
- The sun's `elevation` is in degrees above the horizon, so a low value gives a sunset. `exp2` fog density is around 0.01 to 0.05.
- Each change replaces whole sections. A person editing the same section at the same time can make yours refused: read the asset again, then retry.
- Point a scene at it with the scene's `useEnvironment` intent, by id or path.
- Lights placed in a scene add to the environment's sun and ambient light. A new scene seeds a "Sun" and a "Sky" light for the `default` environment, which has neither. With an environment that has a sun, remove or dim those lights, or the scene is lit twice.
- You cannot see the result, and `catalog_preview` has no image for environments. Report the values you set.
- In a script, `golem.open(assetId, "environment")` returns an `EnvironmentAsset` with `read()` and `change(input)`, which takes the intent's input.
