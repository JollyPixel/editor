---
"@jolly-pixel/ui": major
"@jolly-pixel/asset-server": patch
"@jolly-pixel/accounts": patch
"@jolly-pixel/network": patch
"@jolly-pixel/runtime": patch
"@jolly-pixel/console": patch
"@jolly-pixel/lantern": patch
---

Add `@jolly-pixel/utils` for shared helpers (`is` guards, `errorMessage`, `clamp`, `formatBytes`, base64, `TaskChain`, `Teardown`/`AsyncTeardown`, and `saveFile` from `@jolly-pixel/utils/dom`).
`saveFile` and `formatBytes` move out of `@jolly-pixel/ui`; asset-server inline content that is not valid base64 now throws instead of decoding to garbage bytes.
