---
"@jolly-pixel/runtime": minor
---

Add `RuntimeComponentPackage`, the `jollypixel.runtime` contract a package uses to give a game its component definitions, asset loaders and per-type `usesPhysics` checks.
`contributedRuntimeComponents()` folds them into one `ComponentDefinitions`, a loader list and one `usesPhysics()`, refusing duplicates.
