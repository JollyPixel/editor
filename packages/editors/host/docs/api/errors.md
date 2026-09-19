# Errors

Both errors extend `Error` and set `name` to the class name.

| Error | Thrown when |
|---|---|
| `LaunchNotFoundError` | `EditorLaunch.read()` gets no launch from any source |
| `AssetModelConflictError` | `AssetLeases.open()` targets an asset already leased with `openRoom()` |

Sessions and leases also throw `AssetNotFoundError` and
`AssetKindMismatchError` from `@jolly-pixel/asset`.
