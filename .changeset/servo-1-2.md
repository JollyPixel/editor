---
"@jolly-pixel/asset-server": patch
"@jolly-pixel/asset-source": major
---

The content route picks brotli or gzip by q-values, and 8.3 short-name segments such as `sprite~1.png` are rejected as `reserved`. `resolveContentType` is removed: use `contentType(path, DEFAULT_CONTENT_TYPES)` from `@openally/servo`.
