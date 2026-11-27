---
"@jolly-pixel/asset-server": minor
---

Add a `summarizeChange` kind hook, `AssetTags.summarize`, reserved `history/` tags (`TagName.historyPoint`, `TagName.isReserved`) and `backend.activity`, which reports each applied catalog command with its actor. A move-folder reply now includes `from`.
