---
"@jolly-pixel/asset-server": minor
---

Add the optional `build` hook (with an optional media `type`) to `AssetKindHandler` and `AssetBackend.builds`, which builds an asset for a game once per content and stores it in `.jollypixel/builds/`.
`PASS_THROUGH_BUILD` serves the content as it is; binary, texture, model and sound kinds use it.
