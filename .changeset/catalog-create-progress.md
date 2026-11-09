---
"@jolly-pixel/asset-server": minor
---

Add the `catalog:progress` message: the server tells the author of a `catalog:create` each stage it enters (`converting`, then `writing`) before replying.
`CatalogClient.create` takes an `onProgress(stage)` option to follow them.
