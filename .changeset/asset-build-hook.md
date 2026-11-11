---
"@jolly-pixel/asset-server": minor
---

Add the optional `build` hook (with an optional media `type`) to `AssetKindHandler` and `AssetBackend.builds`, which builds an asset for a game once per revision and keeps it in memory.
`PASS_THROUGH_BUILD` serves the content as it is; binary, texture, model and sound kinds use it.
