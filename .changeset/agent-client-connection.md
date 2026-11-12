---
"@jolly-pixel/asset-server": minor
"@jolly-pixel/history": minor
"@jolly-pixel/network": minor
---

`CatalogClient.connect` accepts an abort `signal`, and `@jolly-pixel/network/client` exports `consoleLogger(target?)` to redirect client logs (e.g. to stderr).
`EditableDocumentKind` and history's `LocalEdits` let a client apply raw commands to a synced document; `CommandSync.sendChange` takes the receipts to answer in, `commandUnion` types a command union, and `applyStep`'s `basis` is optional.
