// Import Internal Dependencies
import { BrushStore } from "./BrushStore.ts";
import { SelectionStore } from "./SelectionStore.ts";
import { ShellStore } from "./ShellStore.ts";
import { WorldStore } from "./WorldStore.ts";

export class EditorState {
  readonly selection = new SelectionStore();
  readonly brush = new BrushStore();
  readonly shell = new ShellStore();
  readonly world = new WorldStore();
}

export const editorState = new EditorState();
