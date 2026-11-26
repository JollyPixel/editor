// Import Third-party Dependencies
import type { AssetRecordData } from "@jolly-pixel/asset";
import type { CatalogClient } from "@jolly-pixel/asset-server/client";
import type { Notifier } from "@jolly-pixel/ui";
import type { KindFilter } from "@jolly-pixel/server";

// Import Internal Dependencies
import type { AssetDeletion } from "../../catalog/AssetDeletion.ts";
import type {
  ConversionChoice,
  ConvertibleFiles
} from "../../catalog/AssetDrop.ts";
import type { AssetKindSet } from "../../catalog/AssetKindSet.ts";
import type { AssetOccupancy } from "../../catalog/AssetOccupancy.ts";
import type {
  AssetDependencies,
  AssetLeafData
} from "../../catalog/AssetTreeModel.ts";
import type { DroppedFile } from "../../browser/DroppedFile.ts";
import type { BrowserState } from "../../browser/BrowserState.ts";
import type {
  AssetCommandCatalog,
  ConflictQuestion
} from "./AssetCommands.ts";

export type AssetTreeCatalogEvent = "change" | "dependencies" | "rights";

export interface AssetTreeCatalog
  extends AssetCommandCatalog, Pick<CatalogClient, "can"> {
  readonly dependencies: AssetDependencies;
  records(): Iterable<AssetRecordData>;
  folders(): Iterable<string>;
  record(
    assetId: string
  ): AssetRecordData | undefined;
  on(
    event: AssetTreeCatalogEvent,
    listener: () => void
  ): unknown;
  off(
    event: AssetTreeCatalogEvent,
    listener: () => void
  ): unknown;
}

export type AssetTreeState = Pick<
  BrowserState,
  "assetKind" | "expandedFolders"
>;

export interface AssetDeleteChoice {
  companions: boolean;
}

export interface AssetDropQuestions {
  conversion(
    files: ConvertibleFiles
  ): Promise<ConversionChoice | null>;
  conflicts: ConflictQuestion;
}

export interface AssetActionPrompts {
  open(assetId: string): void;
  rename(nodeId: string): void;
  /**
   * `null` when the studio cannot open share links, which hides the action.
   */
  share: ((asset: AssetLeafData) => void) | null;
  confirmDelete(
    deletion: AssetDeletion,
    occupancy: AssetOccupancy
  ): Promise<AssetDeleteChoice | null>;
  confirmLargeFiles(files: readonly DroppedFile[]): Promise<boolean>;
  pickFile(accept: readonly string[]): Promise<File | null>;
}

export interface KindFilterSource extends EventTarget {
  readonly kindFilter: KindFilter;
}

export interface OccupancySource extends EventTarget {
  readonly occupancy: AssetOccupancy;
}

export interface AssetTreeViewOptions {
  catalog: AssetTreeCatalog;
  kinds: AssetKindSet;
  /**
   * The project's kind filter; `null` offers every kind.
   */
  kindFilter: KindFilterSource | null;
  presence: OccupancySource | null;
  browserState: AssetTreeState;
  /**
   * What the actions need from the page: dialogs, inline rename, opening.
   */
  prompts: AssetActionPrompts;
  notifications: Notifier;
  onChange: () => void;
  /**
   * Called with a created folder, or the draft row of a new asset, to name it.
   */
  onCreated: (nodeId: string) => void;
  /**
   * Called once a named draft, or the first file of a drop, shows in the tree
   * as an asset.
   */
  onRevealed: (nodeId: string) => void;
}
