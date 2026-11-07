---
"@jolly-pixel/asset-server": major
---

Catalog `content` fields and the binary kinds' room snapshot now carry raw `Uint8Array` bytes (network `bytesSchema`) instead of base64 inline content.
Stored events keep the base64 `AssetInlineContent` form, so existing event stores and projects load unchanged; `@jolly-pixel/asset-server/client` no longer exports that type.
