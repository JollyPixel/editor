---
"@jolly-pixel/asset-server": major
---

Catalog `content` fields, the binary kinds' room snapshot and stored `AssetInlineContent` now carry raw `Uint8Array` bytes (network `bytesSchema`) instead of base64.
Stored events written in the base64 form still load: `parseAssetEvent` decodes them. `@jolly-pixel/asset-server/client` no longer exports `AssetInlineContent`, and the root drops `encodeContent` and `decodeContent`: write `{ type: "inline", data }`.
