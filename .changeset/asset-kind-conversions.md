---
"@jolly-pixel/asset-server": minor
---

Add `AssetKindHandler.conversions`: a catalog create with `from` (an extension such as `".png"`) converts the content into the kind's format before writing it.
`KindPackage.descriptors` returns `LoadedAssetKind`, which lists those extensions as `convertsFrom`; `from` requires content.
