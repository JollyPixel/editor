---
"@jolly-pixel/asset-server": major
---

`AssetTags` takes `kinds`, and a tag backup stores each part at its part file path. Every asset room reserves `subscribe-parts` and `unsubscribe-parts`, and a tag room subscribes each member to every part.
`parts.list` reads the manifest bytes instead of a state, so writes no longer load the manifest. Add `partRequests()` to split a part request into messages the room accepts.
