// Import Third-party Dependencies
import type { ReactiveControllerHost } from "lit";
import {
  resolveReparentMoves,
  type JollyActivateDetail,
  type JollyActivateSwatchDetail,
  type JollyRenameDetail,
  type JollyReparentDetail,
  type JollySelectDetail,
  type JollyToggleExpandDetail,
  type TreeDropAccept,
  type TreeNode
} from "@jolly-pixel/ui";
import {
  decodeMaterialTransfer,
  encodeMaterialTransfer,
  type BlockNodeJSON,
  type MaterialEntryJSON,
  type ModelChange,
  type ModelDocument,
  type VoxelModelCommand,
  type ModelMaterialJSON,
  type ModelMaterialsReader
} from "@jolly-pixel/asset.voxel-model/client";

// Import Internal Dependencies
import type {
  BlockSelectionStore,
  MaterialFocusStore,
  PresenceStore
} from "../../../state/index.ts";
import { WorkspaceController } from "../../../shared/WorkspaceController.ts";
import { ExpandedRows } from "../../../shared/ExpandedRows.ts";
import {
  EMPTY_MENU,
  menuSession,
  rowMenuSession,
  type MenuPoint,
  type MenuSession
} from "../../../shared/menuSession.ts";
import type {
  DeleteContext,
  DeleteResult
} from "../../../shared/DeleteDialog.ts";
import type { MaterialPreset } from "./materialPresets.ts";
import {
  FOLDER_MENU,
  ROOT_MENU,
  materialMenu,
  type FolderAction,
  type MaterialRowAction,
  type RootAction
} from "./materialMenu.ts";
import { toMaterialTreeNodes } from "./materialTreeNodes.ts";
import { blockCount } from "../blockCount.ts";

// CONSTANTS
const kFolderName = "Folder";

type RowAction = FolderAction | MaterialRowAction;

export interface MaterialWorkspace {
  document: ModelDocument;
  selection: BlockSelectionStore;
  materialFocus: MaterialFocusStore;
  presence: PresenceStore;
}

export interface MaterialLibraryPrompts {
  promptDelete(
    context: DeleteContext
  ): Promise<DeleteResult | null>;
  beginRename(
    id: string
  ): void;
  /** `choose` runs only when the person picks a preset. */
  choosePreset(
    choose: (preset: MaterialPreset) => void,
    point: MenuPoint
  ): void;
  writeClipboard(
    text: string
  ): Promise<void>;
  /** `null` when the browser refuses to read the clipboard. */
  readClipboard(): Promise<string | null>;
}

export interface SelectedBlockState {
  name: string;
  materialId: string | null;
  materialName: string | null;
}

/** A new object whenever any of it changes. */
export interface MaterialLibraryState {
  nodes: readonly TreeNode[];
  selectedId: string | null;
  /** The selected row when it is a material, as the material focus holds it. */
  editedId: string | null;
  expanded: readonly string[];
  block: SelectedBlockState | null;
}

export class MaterialLibraryController {
  #host: ReactiveControllerHost;
  #prompts: MaterialLibraryPrompts;
  #connection: WorkspaceController<MaterialWorkspace>;
  #selectedId: string | null = null;
  #expanded = new ExpandedRows();
  #state: MaterialLibraryState | null = null;

  readonly #rootActions: Record<RootAction, (point: MenuPoint) => Promise<void> | void> = {
    "new-material": (point) => this.#prompts.choosePreset((preset) => this.create(preset), point),
    "new-folder": () => this.#newFolder(null),
    paste: () => this.#pasteFromClipboard()
  };

  readonly #rowActions: Record<
    RowAction,
    (id: string, point: MenuPoint) => Promise<void> | void
  > = {
    "new-material": (id, point) => this.#prompts.choosePreset(
      (preset) => this.create(preset, id),
      point
    ),
    "new-folder": (id) => this.#newFolder(id),
    assign: (id) => this.assign(id),
    rename: (id) => this.#prompts.beginRename(id),
    duplicate: (id) => this.duplicate(id),
    copy: (id) => this.#copyToClipboard(id),
    delete: (id) => this.remove(id)
  };

  #onChange = (
    change: ModelChange
  ): void => {
    if (this.#selectedId !== null && !this.#library()?.has(this.#selectedId)) {
      this.#pick(null);
    }

    const { command } = change;
    const parentId = landingParentOf(command);
    if (parentId !== null) {
      this.#expanded.expand(parentId);
    }
    if (
      command.action === "node-material-changed" &&
      command.id === this.#workspace?.selection.selected
    ) {
      this.#followBlock();
    }
    this.#invalidate();
  };

  #onReset = (): void => {
    this.#pick(null);
    this.#expanded.reset(
      [...this.#library()?.values() ?? []]
        .filter((entry) => entry.kind === "folder")
        .map(({ id }) => id)
    );
    this.#followBlock();
    this.#invalidate();
  };

  #onSelectBlock = (): void => {
    this.#followBlock();
    this.#invalidate();
  };

  #onPeerEdits = (): void => {
    this.#invalidate();
  };

  constructor(
    host: ReactiveControllerHost,
    prompts: MaterialLibraryPrompts
  ) {
    this.#host = host;
    this.#prompts = prompts;
    this.#connection = new WorkspaceController(
      host,
      (workspace) => this.#subscribeTo(workspace)
    );
  }

  get #workspace(): MaterialWorkspace | null {
    return this.#connection.current;
  }

  get state(): MaterialLibraryState {
    this.#state ??= this.#buildState();

    return this.#state;
  }

  readonly acceptDrop: TreeDropAccept = (detail) => detail.where !== "inside" ||
    this.#library()?.get(detail.targetId)?.kind === "folder";

  attach(
    workspace: MaterialWorkspace
  ): void {
    this.#connection.attach(workspace);
    this.#onReset();
  }

  select(
    id: string | null
  ): void {
    this.#pick(id);
    this.#invalidate();
  }

  rename(
    id: string,
    name: string
  ): void {
    const stored = this.#library()?.get(id);
    const trimmed = name.trim();
    if (stored !== undefined && trimmed !== "" && trimmed !== stored.name) {
      this.#workspace?.document.renameMaterial(id, trimmed);
    }
  }

  create(
    preset: MaterialPreset,
    parentId: string | null = null
  ): void {
    this.#adopt(this.#workspace?.document.addMaterial({
      name: preset.label,
      surface: preset.surface,
      parentId
    }) ?? null);
  }

  createFolder(
    parentId: string | null = null
  ): string | null {
    const id = this.#workspace?.document.addMaterialFolder({
      name: kFolderName,
      parentId
    }) ?? null;
    if (id !== null) {
      this.select(id);
    }

    return id;
  }

  duplicate(
    materialId: string
  ): void {
    const document = this.#workspace?.document;
    const source = this.#material(materialId);
    if (document === undefined || source === undefined) {
      return;
    }

    this.#adopt(document.addMaterial({
      name: `${source.name} Copy`,
      surface: source.surface,
      parentId: source.parentId,
      beforeId: document.tree.materials.nextSiblingOf(source.id)
    }));
  }

  async remove(
    id: string
  ): Promise<void> {
    const entry = this.#library()?.get(id);
    if (entry === undefined) {
      return;
    }

    const confirmation = this.#deleteConfirmation(entry);
    const result = confirmation === null ?
      { deleteChildren: true } :
      await this.#prompts.promptDelete(confirmation);
    if (result !== null) {
      this.#workspace?.document.removeMaterial(id, {
        keepContents: entry.kind === "folder" && !result.deleteChildren
      });
    }
  }

  assign(
    materialId: string | null
  ): void {
    const block = this.#selectedBlock();
    if (block !== undefined && (block.materialId ?? null) !== materialId) {
      this.#workspace?.document.assignMaterial(block.id, materialId);
    }
  }

  copy(
    materialId: string
  ): string | null {
    const material = this.#material(materialId);

    return material === undefined ?
      null :
      encodeMaterialTransfer([material]);
  }

  paste(
    text: string
  ): boolean {
    const document = this.#workspace?.document;
    const materials = decodeMaterialTransfer(text);
    if (document === undefined || materials === null || materials.length === 0) {
      return false;
    }

    const [first = null] = materials.map(
      ({ name, surface }) => document.addMaterial({ name, surface })
    );
    this.#adopt(first);

    return true;
  }

  readonly handleSelect = (
    event: CustomEvent<JollySelectDetail>
  ): void => {
    this.select(event.detail.selected[0] ?? null);
  };

  readonly handleActivateSwatch = (
    event: CustomEvent<JollyActivateSwatchDetail>
  ): void => {
    this.select(event.detail.id);
  };

  readonly handleRename = (
    event: CustomEvent<JollyRenameDetail>
  ): void => {
    this.rename(event.detail.id, event.detail.name);
  };

  readonly handleToggleExpand = (
    event: CustomEvent<JollyToggleExpandDetail>
  ): void => {
    this.#expanded.set(event.detail.id, event.detail.expanded);
    this.#invalidate();
  };

  readonly handleReparent = (
    event: CustomEvent<JollyReparentDetail>
  ): void => {
    const moves = resolveReparentMoves({
      nodes: [...this.state.nodes],
      ...event.detail
    });
    for (const { id, parentId, beforeId } of moves) {
      this.#workspace?.document.moveMaterial(id, parentId, beforeId);
    }
  };

  readonly handleActivate = (
    event: CustomEvent<JollyActivateDetail>
  ): void => {
    const { id } = event.detail;
    const entry = this.#library()?.get(id);
    if (entry?.kind === "material") {
      this.assign(id);
    }
    else if (entry?.kind === "folder") {
      this.#expanded.toggle(id);
      this.#invalidate();
    }
  };

  menuFor(
    id: string | null
  ): MenuSession {
    if (id === null) {
      return menuSession(ROOT_MENU, (action, point) => this.#rootActions[action](point));
    }

    const entry = this.#library()?.get(id);
    if (entry === undefined) {
      return EMPTY_MENU;
    }

    return rowMenuSession<RowAction>(
      entry.kind === "folder" ? FOLDER_MENU : materialMenu(this.#assignTarget(id)),
      () => this.#library()?.has(id) === true,
      (action, point) => this.#rowActions[action](id, point)
    );
  }

  #deleteConfirmation(
    entry: MaterialEntryJSON
  ): DeleteContext | null {
    if (entry.kind === "folder") {
      return this.#library()?.childrenOf(entry.id).length ?
        {
          heading: "Delete Folder",
          hasChildren: true,
          childrenLabel: "Delete its materials too"
        } :
        null;
    }

    const uses = this.#workspace?.document.tree.blocksUsing(entry.id).length ?? 0;

    return uses === 0 ?
      null :
      {
        heading: "Delete Material",
        hasChildren: false,
        message: `${entry.name} is used by ${blockCount(uses)}. ` +
          `${uses === 1 ? "It" : "They"} will have no material.`
      };
  }

  #newFolder(
    parentId: string | null
  ): void {
    const folderId = this.createFolder(parentId);
    if (folderId !== null) {
      this.#prompts.beginRename(folderId);
    }
  }

  async #pasteFromClipboard(): Promise<void> {
    const text = await this.#prompts.readClipboard();
    if (text !== null) {
      this.paste(text);
    }
  }

  async #copyToClipboard(
    materialId: string
  ): Promise<void> {
    const text = this.copy(materialId);
    if (text !== null) {
      await this.#prompts.writeClipboard(text);
    }
  }

  #selectedBlock(): BlockNodeJSON | undefined {
    const workspace = this.#workspace;
    const selected = workspace?.selection.selected ?? null;

    return selected === null ? undefined : workspace?.document.tree.block(selected);
  }

  #assignTarget(
    materialId: string
  ): string | null {
    const block = this.#selectedBlock();

    return block === undefined || block.materialId === materialId ?
      null :
      block.name;
  }

  #adopt(
    materialId: string | null
  ): void {
    if (materialId === null) {
      return;
    }

    this.select(materialId);
    if (this.#selectedBlock()?.materialId === undefined) {
      this.assign(materialId);
    }
  }

  #followBlock(): void {
    const materialId = this.#selectedBlock()?.materialId;
    if (materialId !== undefined && materialId !== this.#selectedId) {
      this.#pick(materialId);
    }
  }

  #pick(
    id: string | null
  ): void {
    this.#selectedId = id;
    let parentId = id === null ? null : this.#library()?.get(id)?.parentId ?? null;
    while (parentId !== null) {
      this.#expanded.expand(parentId);
      parentId = this.#library()?.get(parentId)?.parentId ?? null;
    }
    this.#workspace?.materialFocus.edit(
      this.#material(id) === undefined ? null : id
    );
  }

  #invalidate(): void {
    this.#state = null;
    this.#host.requestUpdate();
  }

  #buildState(): MaterialLibraryState {
    const workspace = this.#workspace;
    const tree = workspace?.document.tree;

    return {
      nodes: toMaterialTreeNodes({
        entries: [...tree?.materials.values() ?? []],
        uses: tree?.materialUses() ?? new Map(),
        marks: workspace?.presence.materialEdits ?? new Map()
      }),
      selectedId: this.#selectedId,
      editedId: workspace?.materialFocus.edited ?? null,
      expanded: this.#expanded.ids,
      block: this.#blockState()
    };
  }

  #blockState(): SelectedBlockState | null {
    const block = this.#selectedBlock();
    if (block === undefined) {
      return null;
    }

    const material = this.#material(block.materialId ?? null);

    return {
      name: block.name,
      materialId: material?.id ?? null,
      materialName: material?.name ?? null
    };
  }

  #library(): ModelMaterialsReader | undefined {
    return this.#workspace?.document.tree.materials;
  }

  #material(
    materialId: string | null
  ): ModelMaterialJSON | undefined {
    return materialId === null ?
      undefined :
      this.#library()?.material(materialId);
  }

  #subscribeTo(
    workspace: MaterialWorkspace
  ): Array<() => void> {
    const {
      document,
      selection,
      presence
    } = workspace;

    return [
      document.subscribe("change", this.#onChange),
      document.subscribe("reset", this.#onReset),
      selection.subscribe("select", this.#onSelectBlock),
      presence.subscribe("materialEditsChange", this.#onPeerEdits),
      () => workspace.materialFocus.edit(null)
    ];
  }
}

function landingParentOf(
  command: VoxelModelCommand
): string | null {
  switch (command.action) {
    case "material-added":
      return command.material.parentId;
    case "material-folder-added":
      return command.folder.parentId;
    case "material-moved":
      return command.parentId;
    default:
      return null;
  }
}
