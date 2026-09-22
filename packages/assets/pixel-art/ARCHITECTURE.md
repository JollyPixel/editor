# Pixel-art architecture

`PixelArtState` holds the authoritative `PixelBuffer`. The server opens one room per asset; the browser keeps a `PixelDocument` in sync with it. The shared room and persistence lifecycle is shown in [asset workspace architecture](../ARCHITECTURE.md).

```mermaid
flowchart TB
    Document["PixelDocument"] -->|"local buffer event"| Sync["PixelSyncClient"]
    Sync --> Room["Asset room"]
    Room -->|"validate"| Arbiter["PixelCommandArbiter"]
    Arbiter -->|"admission"| Log["Event log"]
    Log -->|"fold"| State["PixelArtState.buffer"]
    Room -->|"command or snapshot"| Sync
    Canvas["Canvas presence helpers"] <--> Room
```

## Edits and conflicts

`commands.apply` is the sole writer of the server buffer. The arbiter checks the current buffer; its conflict trackers commit only after the event append succeeds. Event replay uses the same apply function.

```mermaid
flowchart TB
    Command["Pixel command"] --> Choice{"Action"}
    Choice -->|"stroke or select-edit"| Pixels["One key per pixel"]
    Choice -->|"UV move, rotate, delete or state"| UV["Region and face keys"]
    Choice -->|"resize, replace or other"| Unkeyed["Validation and room order"]
    Pixels --> Admission["Admitted positions only"]
    UV --> Admission
    Unkeyed --> Admission
```

Selection edits keep colors aligned with admitted positions. The arbiter also checks selection lengths, UV data, and allowed buffer sizes. Room presence carries cursors and edit previews; it does not enter the event log or mutate the buffer. See the [network API](./docs/network.md) for the client contract.
