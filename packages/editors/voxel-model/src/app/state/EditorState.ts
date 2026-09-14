// Import Third-party Dependencies
import { LogQueue } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { PresenceStore } from "./PresenceStore.ts";

export class EditorState {
  readonly presence = new PresenceStore();
  readonly log = new LogQueue();
}

export const editorState = new EditorState();
