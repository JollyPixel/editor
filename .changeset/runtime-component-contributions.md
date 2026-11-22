---
"@jolly-pixel/runtime": minor
---

Add `Systems.ComponentPackage`, the `jollypixel.runtime` contract a package uses to give a game its component definitions, asset loaders and per-type `usesPhysics` checks, and `Systems.contributedComponents()`, which folds them together and refuses duplicates.
The runtime adds `ThreeComponentPackage` and `ThreeAssetLoaderDefinition`, whose loaders receive its `LoadingManager`.
