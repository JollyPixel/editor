---
"@jolly-pixel/asset-server": major
---

`catalog:rename` and `catalog:delete` take only a `renames` or `assetIds` list, applied in order up to the first refused entry and answered with `{ applied, failure? }`; `CatalogClient` adds `renameMany` and `removeMany`.
`catalog:changed` now carries a `changes` list, and the changes of a list command reach members in one message.
