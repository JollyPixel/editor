---
"@jolly-pixel/asset-server": patch
---

Importing `TEXTURE_ASSET`, `TEXTURE_KIND`, `TEXTURE_COMMAND` or `TEXTURE_EXTENSIONS` no longer bundles the texture kind handler: they live in a module of their own.
