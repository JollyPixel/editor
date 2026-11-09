---
"@jolly-pixel/runtime": minor
---

Add `RuntimeComponentPackage`, the `jollypixel.runtime` contract a package uses to give a game its component definitions, asset loaders and world `setup`.
`contributedRuntimeComponents()` folds them into one `ComponentDefinitions`, a loader list and one `setup()`, refusing duplicates.
