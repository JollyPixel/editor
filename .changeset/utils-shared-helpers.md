---
"@jolly-pixel/utils": minor
"@jolly-pixel/asset-server": patch
"@jolly-pixel/accounts": patch
"@jolly-pixel/network": patch
"@jolly-pixel/console": patch
"@jolly-pixel/runtime": patch
"@jolly-pixel/ui": patch
---

Add `DistributiveOmit`, `DeepReadonly`, `Simplify`, `parseJsonObject`, `wrap`, `roundTo`, `delay`, `yieldToEventLoop`, `withTimeout`, `InFlight` and `sha256Hex` to `@jolly-pixel/utils`.
The other packages drop their local copies of these helpers and import them from utils.
