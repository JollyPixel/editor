// Import Internal Dependencies
import type { EditorTags } from "./EditorTags.ts";
import type { EditorTargets } from "./EditorTargets.ts";

export class EditorToolbarSources {
  readonly targets: EditorTargets | null;
  readonly tags: EditorTags | null;

  constructor(
    targets: EditorTargets | null,
    tags: EditorTags | null
  ) {
    this.targets = targets;
    this.tags = tags;
  }

  dispose(): void {
    this.targets?.dispose();
    this.tags?.dispose();
  }
}
