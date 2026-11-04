---
"@jolly-pixel/asset-server": major
---

An `AssetConversion` now returns a `ConvertedAsset` whose `companions` are created next to the asset and linked through the kind's `rebind`.
`CreateAssetInput` takes either a payload (`data`, `parts`, `dependencies`) or a `converted` asset; `catalog.replace` refuses a conversion with companions (`CompanionReplacementError`).
