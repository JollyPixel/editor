---
"@jolly-pixel/asset-server": major
"@jolly-pixel/asset-source": minor
---

`AssetKindHandler` replaces `match` + `contentTypes` with required `extensions` (extension to content type, multi-dot allowed); `match` now only narrows the claim.
`textureAssetHandler`/`binaryAssetHandler` are renamed `textureAssetKind`/`binaryAssetKind`, and `resolveContentType` picks the longest matching extension.
