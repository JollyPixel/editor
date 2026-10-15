// Import Third-party Dependencies
import type { Lantern } from "@jolly-pixel/lantern";

// Import Internal Dependencies
import type { ConnectionStatus } from "./ConnectionStatus.ts";
import type { EditorTags } from "./EditorTags.ts";
import type { EditorTargets } from "./EditorTargets.ts";

export interface EditorToolbarSourcesOptions {
  targets: EditorTargets | null;
  tags: EditorTags | null;
  /**
   * @default null
   */
  connectionStatus?: ConnectionStatus | null;
  lantern: Lantern;
}

export class EditorToolbarSources {
  readonly targets: EditorTargets | null;
  readonly tags: EditorTags | null;
  readonly connectionStatus: ConnectionStatus | null;
  readonly lantern: Lantern;

  constructor(
    options: EditorToolbarSourcesOptions
  ) {
    this.targets = options.targets;
    this.tags = options.tags;
    this.connectionStatus = options.connectionStatus ?? null;
    this.lantern = options.lantern;
  }

  dispose(): void {
    this.targets?.dispose();
    this.tags?.dispose();
  }
}
