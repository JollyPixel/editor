# Asset workspaces architecture

Each workspace in this directory owns one or two editable asset kinds. The
server stores and arbitrates them; the editors open and edit them.

## Inside one workspace

```mermaid
flowchart TB
    subgraph Server["Server side (package root, ./server)"]
        Kind["src/asset<br/>kind handler, state, file codec"]
        Arbiter["src/network<br/>command schemas and arbiter"]
    end

    subgraph Client["Browser side (./client)"]
        Document["src/model or a renderer<br/>document the editor edits"]
        Sync["src/network<br/>room client and sync"]
        History["src/history<br/>undo keys"]
    end

    Sync -->|"commands"| Arbiter
    Kind --> Document
    Sync --> Document
    History --> Document
```

- The server and the editor share the same model: the server replays commands
  on it, the editor draws it.
- Browser code imports `./client` only; the root pulls in server dependencies.
- Code: `src/asset/`, `src/model/`, `src/network/`, `src/history/`; pixel-art
  and voxel-map take their document from the renderer packages instead.

## Where a workspace plugs in

```mermaid
flowchart TB
    Editor["Editor<br/>(editors/*)"]
    Workspace["Asset workspace"]
    Server["@jolly-pixel/asset-server<br/>catalog, rooms, event history"]
    Source["@jolly-pixel/asset-source<br/>files on disk or in memory"]

    Editor -->|"opens the asset room"| Workspace
    Workspace -->|"registers its kind handler"| Server
    Workspace <-->|"commands and snapshots"| Server
    Server -->|"writes snapshots"| Source
```

- The catalog room creates, renames and deletes assets; one asset room per
  open asset carries its edits.
- An asset keeps its ID when its path or content changes.

## From edit to stored asset

```mermaid
flowchart TB
    Edit["Editor applies the edit locally"]
    Room["Asset room arbitrates the command"]
    Log["Command appended to the event history"]
    Broadcast["Command broadcast to every peer"]
    Correct["Author receives a correction or a snapshot"]
    Save["Snapshot written to the source after editing stops"]

    Edit --> Room
    Room -->|"accepted"| Log
    Room -->|"refused"| Correct
    Log --> Broadcast
    Broadcast --> Save
```

- Edits show at once; the room has the final word.
- On restart, the server replays the history to rebuild each asset.

## Assets reference each other

```mermaid
flowchart TB
    Scene["scene"]
    Map["voxelmap"]
    Model["voxelmodel"]
    Blockset["blockset"]
    Animation["voxelanimation"]
    PixelArt["pixelart"]
    Terrain["terrain"]
    Texture["texture (image)"]

    Scene -->|"components"| Map
    Map --> Blockset
    Model --> PixelArt
    Model --> Animation
    Terrain -->|"material maps"| Texture
```

- Scene components may reference assets of any kind.
- A reference is an asset ID and kind; the catalog lists each asset's
  references as its dependencies.
- Creating a voxel map also creates its blockset; creating a voxel model also
  creates its pixel-art texture.
