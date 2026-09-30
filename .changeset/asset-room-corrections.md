---
"@jolly-pixel/asset-server": minor
---

`AssetLiveProtocol` gains an optional `correct(command, admitted)`. When it returns a command, a refused or narrowed edit resyncs its author with a `correction` instead of a full snapshot.
