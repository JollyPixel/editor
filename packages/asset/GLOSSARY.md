# Asset glossary

This glossary defines the vocabulary for asset identity, persistence, and
runtime loading. The asset bounded context is shared by browser and Node.js
applications. Scene activation, ECS lifecycle, import processing, and network
transport belong to neighboring contexts.

## Terms

### Asset

A logical resource used by a project or runtime. An asset keeps its identity
when its source or content changes.

### Asset ID

The stable identity of one asset. Editors and backends create IDs; scenes use
them without knowing where the asset is stored.

### Asset Kind

The persistent category of an asset, such as `model`, `audio`, or `texture`.
The kind selects the loading behavior expected for a record.

### Asset Type

The runtime contract for one asset kind and the value it produces. Code shares
one asset type when creating references and registering the matching loader.

### Asset Reference

A portable statement that a consumer needs an asset with a given ID and type.
References belong in scenes, components, saved data, and network messages.
They do not contain a storage location.

### Asset Record

The catalog description of one asset. A record connects its stable ID and kind
to a source, with an optional revision.

### Asset Catalog

The authoritative collection of asset records for one project or session. It
resolves references while keeping storage details outside scenes and
components.

### Asset Source

An opaque address understood by a loader. It may represent a project path,
URL, filesystem location, database key, or another application-defined scheme.

### Asset Revision

An optional marker for a particular version of an asset's content. Updating a
revision does not change the asset ID.

### Asset Manifest

The persistent representation of an asset catalog. A manifest can be stored or
sent across a boundary without containing loaded runtime values.

### Asset Loader

The adapter that reads an asset record and produces its runtime value. Loaders
own platform-specific I/O and decoding.

### Asset Value

The in-memory result produced by a loader, such as a decoded model, audio
buffer, or text document.

### Asset Handle

A consumer's synchronous access point to an asset value. A handle also exposes
whether the value is unloaded, loading, ready, or failed.

### Asset Store

The runtime owner of loaded values and in-flight loads. A shared store prevents
the same asset from being loaded twice at the same time.

### Asset Coordinator

The application service that connects references, catalog records, loaders,
and the store. It starts explicit single-asset loads and load batches.

### Asset Dependency

An asset reference required before an operation can continue. The runtime
decides which dependencies belong to startup, a scene transition, or dynamic
content.

### Asset Load Batch

One loading operation over a fixed set of dependencies. A batch owns its
progress and failures while sharing loaded values with other batches.

## Naming boundaries

- Use **asset** for the logical resource, **source** for its address, and
  **value** for its loaded form.
- Use **asset ID** for identity, **asset reference** for a consumer's need, and
  **asset record** for catalog metadata.
- Use **asset kind** for persisted categorization and **asset type** for the
  runtime value contract.
- Use **catalog** for persistent records and **store** for runtime state.
- Use **loader** for I/O and decoding and **coordinator** for dispatch and
  loading operations.
- Use **dependency** for one required reference and **load batch** for the
  operation that waits for a set of dependencies.
