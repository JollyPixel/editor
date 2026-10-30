// Import Third-party Dependencies
import type { Lantern } from "@jolly-pixel/lantern";

// Import Internal Dependencies
import type { ConnectionStatus } from "../connection/ConnectionStatus.ts";
import type { EditorArchives } from "./EditorArchives.ts";
import type { EditorTags } from "./EditorTags.ts";
import type { EditorTargets } from "./EditorTargets.ts";

export type EditorToolbarArchives = Pick<
  EditorArchives,
  | "canImport"
  | "canReset"
  | "dependencies"
  | "download"
  | "downloadAsset"
  | "pickAndImport"
  | "reset"
>;

export interface EditorToolbarSourcesOptions {
  targets: EditorTargets | null;
  tags: EditorTags | null;
  archives: EditorToolbarArchives;
  /**
   * @default null
   */
  connectionStatus?: ConnectionStatus | null;
  lantern: Lantern;
}

export class EditorToolbarSources {
  readonly targets: EditorTargets | null;
  readonly tags: EditorTags | null;
  readonly archives: EditorToolbarArchives;
  readonly connectionStatus: ConnectionStatus | null;
  readonly lantern: Lantern;

  constructor(
    options: EditorToolbarSourcesOptions
  ) {
    this.targets = options.targets;
    this.tags = options.tags;
    this.archives = options.archives;
    this.connectionStatus = options.connectionStatus ?? null;
    this.lantern = options.lantern;
  }

  dispose(): void {
    this.targets?.dispose();
    this.tags?.dispose();
  }
}
