---
status: accepted
---

# Folders are path prefixes, and partial folder commands are not rolled back

The catalog has assets, not folders. The tree derives a folder from each path prefix its assets
share, so renaming, moving or deleting a folder sends one catalog command per asset under it.

The new label shows while the commands run and reverts on a rejection. Commands already applied
are not rolled back; the log says how many went through. A kind filter hides assets from the tree,
not from a folder command: it still covers every asset under the folder.

Folder node ids are `folder:<path>` and asset node ids `asset:<id>`, so a rename keeps the node,
its selection and its expanded state.

## Considered Options

- **Folder records in the catalog.** A second source of truth beside the paths, and empty folders
  the back-end would have to persist.
- **Rolling back a partial rename.** The undo is itself a batch of commands that can fail half way.
