// Import Third-party Dependencies
import { LogQueue } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { BrushStore } from "./BrushStore.ts";
import { PresenceStore } from "./PresenceStore.ts";
import { SelectionStore } from "./SelectionStore.ts";
import { TilesetStore } from "./TilesetStore.ts";

export class EditorState {
  readonly selection = new SelectionStore();
  readonly brush = new BrushStore();
  readonly presence = new PresenceStore();
  readonly tilesets = new TilesetStore();
  readonly log = new LogQueue();
}
