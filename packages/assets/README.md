# Asset workspaces

The packages in this directory define editable asset formats. Each format
provides an asset kind for the server and a client-side way to work with its
content. An asset keeps its ID when its path or content changes; the catalog
connects that ID to its current kind, path, and revision.

See [architecture](./ARCHITECTURE.md) for the common workspace structure,
command flow, and persistence lifecycle.

## Formats in this directory

- [pixel-art](./pixel-art/README.md): pixel-art documents and canvas edits
- [voxel-map](./voxel-map/README.md): voxel worlds with optional pixel-art tileset references
- [voxel-model](./voxel-model/README.md): model trees with an optional pixel-art texture reference

For the shared meaning of asset ID, kind, reference, record, and catalog, see
the [asset glossary](../asset/GLOSSARY.md).
