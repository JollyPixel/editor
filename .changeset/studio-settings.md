---
"@jolly-pixel/network": major
"@jolly-pixel/asset-server": major
"@jolly-pixel/ui": minor
---

`CapabilityTable` takes a `CapabilityDeclaration` list checked by `defineCapabilities` (names typed by `CapabilityName`), and `AssetKindDescriptor` can declare one.
One backend `snapshot` policy covers every kind: `replaceSnapshotPolicy` changes it while the backend runs, `DEFAULT_SNAPSHOT_POLICY` holds its default, and project files drop the old per-kind `snapshot` option.
`ProjectFile.replace` writes a record of sections in one write; `jolly-text` gains `suggestions` and `select()`.
