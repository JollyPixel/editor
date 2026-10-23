# Utilities

The package entry point exports helpers for JSON files.
`DEFAULT_IGNORED_PATHS` is exported from `@jolly-pixel/asset-source/node`.
Path helpers are described in [Paths](./Paths.md).

## JSON files

```ts
readJsonFile(
  source: AssetSource,
  path: string
): Promise<unknown>

writeJsonFile(
  source: AssetSource,
  path: string,
  value: unknown
): Promise<void>
```

`readJsonFile` decodes the stored bytes as UTF-8 and parses the result as JSON.
It returns `null` when the file is missing
([`AssetPathNotFoundError`](./Paths.md#assetpathnotfounderror)) or is not
valid JSON. Any other failure, such as a rejected path or a permission error,
is rethrown. Stored JSON `null` also produces `null`, so use `source.read`
directly when the distinction matters.

`writeJsonFile` calls `JSON.stringify(value, null, 2)`, appends a newline,
encodes the text as UTF-8 and writes it through the source.

## Filesystem defaults

`DEFAULT_IGNORED_PATHS` contains the globs used by `FilesystemAssetSource`.
See [Filesystem persistence](./persistence/Filesystem.md#ignored-paths) for the values and
matching behavior.
