---
"@jolly-pixel/console": minor
---

The registry iterates its scopes and a namespace its members; every entry carries `address` and `description`. `InputHistory` adds `browsing`, `size` and `stopBrowsing()`.
A `get` that throws no longer breaks a `ConsoleServer` snapshot: the mirrored variable throws `RemoteValueMissingError` instead.
