---
status: accepted
---

# Folders live in the asset source, and partial folder commands are not rolled back

A folder is a directory of the asset source, not a catalog record. Writing an asset creates its
folders and deleting it keeps them, so a folder stays until someone deletes it, empty or not. The
catalog room lists the source's folders plus those of every asset, and the tree shows all of them
whatever the kind filter. New folder creates the folder in the source at once.

Renaming, moving or deleting a folder still sends one catalog command per asset under it. A
rename or move then sends one folder move, and the back-end recreates the folder's sub-folders at
the destination and deletes the old folder. A delete then deletes the folder. The back-end waits
for pending file writes before it moves or deletes a folder, and keeps any sub-folder that still
holds a file.

The new label shows while the asset commands run and reverts on a rejection. Commands already
applied are not rolled back; the log says how many went through. A failed folder step after every
asset moved keeps the new label and is logged on its own. A kind filter hides assets from the tree,
not from a folder command: it still covers every asset under the folder.

Folder node ids are `folder:<path>` and asset node ids `asset:<id>`, so a rename keeps the node,
its selection and its expanded state.

## Considered Options

- **Folders derived from asset paths only.** The first version: an emptied folder vanished, and a
  new folder lived in one browser until an asset landed in it.
- **Folder events in the event store.** A second history for something that holds no content,
  while the filesystem already keeps directories and reports their changes.
- **Remembering folders per browser.** Empty folders other members and the disk never see.
- **Rolling back a partial rename.** The undo is itself a batch of commands that can fail half way.
