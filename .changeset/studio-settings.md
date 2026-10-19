---
"@jolly-pixel/accounts": minor
"@jolly-pixel/asset-server": minor
"@jolly-pixel/event-store": minor
"@jolly-pixel/network": minor
"@jolly-pixel/engine": minor
---

Settings change without a restart: `Server.replaceRights`, kind options via `ProjectFile.replace`, `KindPackage.withOptions` and `ProjectKinds`/`AssetKindRegistry.replace`, and `Accounts.replaceRoles`/`replaceAccessRequests`; `RightsPattern` is exported.
Accounts store per-account `preferences` and report typed `AccountActivity` events; `listAll` pages newest first with `beforeEventId`.
`OrbitFlyCamera` gains `invertY` and a `touchpadSwipe` look or pan mode.
