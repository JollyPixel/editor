---
"@jolly-pixel/asset-server": minor
---

Kind handlers can declare a `preview(state)` hook, served by the `catalog:preview` query (`CatalogClient.preview`) and flagged `preview: "server"` on loaded kind descriptors.
The built-in texture kind previews png, jpeg, gif, webp and bmp images up to 2 MiB, and `ProjectKinds.descriptors()` now lists it, with `creatable: false`, from the new `BUILT_IN_ASSET_KINDS` package.
