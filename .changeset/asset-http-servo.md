---
"@jolly-pixel/asset-source": major
"@jolly-pixel/asset-server": major
---

The asset static handler and the catalog handler are built on `@openally/servo`: content ETags with `304`, `Cache-Control: no-cache`, `nosniff`, and byte ranges for assets.
`safeAssetPath` now rejects a Windows reserved segment (`:`, trailing dot or space, device name) as `reserved`, so writes, archive imports and every source refuse it, and asset URLs answer `403`.
