---
"@jolly-pixel/asset": patch
---

`AssetPath.resolve()` reads a `\` in a specifier as `/`, and keeps a `%` that starts no valid escape, such as `50% off.png`, instead of throwing `URIError`.
