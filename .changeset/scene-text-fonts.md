---
"@jolly-pixel/engine": major
"@jolly-pixel/asset-server": minor
"@jolly-pixel/history": minor
---

Add `TextDefinition`; `TextRenderer` takes `MeshRenderer`-style settings, either `asset` or `font`, and `configure()`. `ComponentAssetResolver.resolve` may return `null` while an asset loads.
Add `AssetKindDescriptor.creatable` and `readOnlyCommands()` for import-only kinds, and `SnapshotDocument` for documents a client only reads.
