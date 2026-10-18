---
"@jolly-pixel/asset-server": minor
---

`createAssetBackend` accepts `compactOnOpen`, which `createAssetWorkspace` now forwards instead of compacting itself.
The backend ignores a stored `state.json` when its event log is empty, so checkpoints from a lost log no longer hide new events.
