// Import Third-party Dependencies
import type { ReactiveControllerHost } from "lit";
import {
  formatCount,
  SubscriptionController,
  type JollyActivateDetail,
  type JollyActivateSwatchDetail,
  type JollyRenameDetail,
  type JollyReparentDetail,
  type JollySelectDetail,
  type JollyToggleExpandDetail,
  type TreeDropAccept,
  type TreeNode,
  MenuSession,
  disableEntries,
  type MenuPoint
} from "@jolly-pixel/ui";
import {
  decodeMaterialTransfer,
  encodeMaterialTransfer,
  type BlockNodeJSON,
  type ModelChange,
  type ModelDocument,
  type ModelMaterialJSON,
  type ModelMaterialsReader
} from "@jolly-pixel/asset.voxel-model/client";

// Import Internal Dependencies
import type {
  BlockSelectionStore,
  MaterialFocusStore,
  PresenceStore
} from "../../../state/index.ts";
import type { ScopeRecorder } from "../../history/index.ts";
import { ExpandedRows } from "../../../shared/ExpandedRows.ts";
import type { ModelAccessSignals } from "../../../access/ModelAccess.ts";
import type {
  DeleteContext,
  DeleteResult
} from "../../../shared/dialogs/DeleteDialog.ts";
import type { MaterialPreset } from "./materialPresets.ts";
import {
  MATERIAL_MENU,
  ROOT_MENU,
  type MaterialRowAction,
  type RootAction
} from "./materialMenu.ts";
import {
  toMaterialTreeNodes,
  type MaterialUser
} from "./materialTreeNodes.ts";
import {
  blockOfUsageRow,
  usageRowId
} from "./usageRows.ts";

export interface MaterialEditing {
  access: ModelAccessSignals;
  document: ModelDocument;
  history: ScopeRecorder<"material">;
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
  choosePreset(
    choose: (preset: MaterialPreset) => void,
    point: MenuPoint
  ): void;
  writeClipboard(
    text: string
  ): Promise<void>;
  readClipboard(): Promise<string | null>;
}

export interface SelectedBlockState {
  name: string;
  materialId: string | null;
}

export interface MaterialLibraryState {
  nodes: readonly TreeNode[];
  /**
   * The selected block's row when it uses the edited material, otherwise the material's row.
   */
  selectedId: string | null;
  /**
   * The material being edited, as the material focus holds it.
   */
  editedId: string | null;
  expanded: readonly string[];
  block: SelectedBlockState | null;
}

export class MaterialLibraryController {
  #host: ReactiveControllerHost;
  #prompts: MaterialLibraryPrompts;
  #connection: SubscriptionController<MaterialEditing>;
  #expanded = new ExpandedRows();
  #state: MaterialLibraryState | null = null;

  readonly #rootActions: Record<RootAction, (point: MenuPoint) => Promise<void> | void> = {
    "new-material": (point) => this.#prompts.choosePreset((preset) => this.create(preset), point),
    paste: () => this.#pasteFromClipboard()
  };

  readonly #rowActions: Record<MaterialRowAction, (id: string) => Promise<void> | void> = {
    rename: (id) => this.#prompts.beginRename(id),
    duplicate: (id) => this.duplicate(id),
    copy: (id) => this.#copyToClipboard(id),
    delete: (id) => this.remove(id)
  };

  #onChange = (
    change: ModelChange
  ): void => {
    const { command } = change;
    if (
      command.action === "node-material-changed" &&
      command.id === this.#editing?.selection.selected
    ) {
      this.#followBlock();
    }
    if (this.#material(this.#editing?.materialFocus.edited ?? null) === undefined) {
      this.#editing?.materialFocus.edit(null);
    }
    this.#invalidate();
  };

  #onReset = (): void => {
    this.#editing?.materialFocus.edit(null);
    this.#expanded.reset([]);
    this.#followBlock();
    this.#invalidate();
  };

  #onSelectBlock = (): void => {
    this.#followBlock();
    this.#invalidate();
  };

  #onPeerMarks = (): void => {
    this.#invalidate();
  };

  constructor(
    host: ReactiveControllerHost,
    prompts: MaterialLibraryPrompts
  ) {
    this.#host = host;
    this.#prompts = prompts;
    this.#connection = new SubscriptionController(
      host,
      (editing) => this.#subscribeTo(editing)
    );
  }

  get #editing(): MaterialEditing | null {
    return this.#connection.current;
  }

  get state(): MaterialLibraryState {
    this.#state ??= this.#buildState();

    return this.#state;
  }

  get editable(): boolean {
    return this.#editing?.access.current.has("materials") ?? false;
  }

  readonly acceptDrop: TreeDropAccept = (detail) => detail.where !== "inside" &&
    !isUsageRow(detail.targetId) &&
    !detail.movedIds.some(isUsageRow);

  attach(
    editing: MaterialEditing
  ): void {
    this.#connection.attach(editing);
    this.#onReset();
  }

  select(
    materialId: string | null
  ): void {
    this.#editing?.materialFocus.edit(
      this.#material(materialId) === undefined ? null : materialId
    );
    this.#invalidate();
  }

  rename(
    id: string,
    name: string
  ): void {
    const stored = this.#material(id);
    const trimmed = name.trim();
    if (
      this.editable &&
      stored !== undefined &&
      trimmed !== "" &&
      trimmed !== stored.name
    ) {
      this.#editing?.document.renameMaterial(id, trimmed);
    }
  }

  create(
    preset: MaterialPreset
  ): void {
    this.#addAndAdopt(null, (document) => document.addMaterial({
      name: preset.label,
      surface: preset.surface
    }));
  }

  duplicate(
    materialId: string
  ): void {
    const source = this.#material(materialId);
    if (source === undefined) {
      return;
    }

    this.#addAndAdopt(null, (document) => document.addMaterial({
      name: `${source.name} Copy`,
      surface: source.surface,
      parentId: source.parentId,
      beforeId: document.tree.materials.findNextSibling(source.id)
    }));
  }

  async remove(
    id: string
  ): Promise<void> {
    const material = this.#material(id);
    if (material === undefined || !this.editable) {
      return;
    }

    const confirmation = this.#deleteConfirmation(material);
    const confirmed = confirmation === null ||
      await this.#prompts.promptDelete(confirmation) !== null;
    if (confirmed) {
      this.#editing?.document.removeMaterial(id);
    }
  }

  assign(
    materialId: string | null
  ): void {
    const block = this.#selectedBlock();
    if (
      this.editable &&
      block !== undefined &&
      (block.materialId ?? null) !== materialId
    ) {
      this.#editing?.document.assignMaterial(block.id, materialId);
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
    const editing = this.#editing;
    const materials = decodeMaterialTransfer(text);
    if (
      editing === null ||
      !this.editable ||
      materials === null ||
      materials.length === 0
    ) {
      return false;
    }

    const label = materials.length === 1 ?
      `Paste ${materials[0].name}` :
      `Paste ${materials.length} materials`;
    this.#addAndAdopt(label, (document) => {
      const [first = null] = materials.map(({ name, surface }) => document.addMaterial({ name, surface }));

      return first;
    });

    return true;
  }

  readonly handleSelect = (
    event: CustomEvent<JollySelectDetail>
  ): void => {
    const id = event.detail.selected[0] ?? null;
    const blockId = id === null ? null : blockOfUsageRow(id);
    if (blockId === null) {
      this.select(id);

      return;
    }

    this.#editing?.selection.select(blockId);
    this.#followBlock();
    this.#invalidate();
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
    this.#expanded.toggle(event.detail.id, event.detail.expanded);
    this.#invalidate();
  };

  readonly handleReparent = (
    event: CustomEvent<JollyReparentDetail>
  ): void => {
    const { movedIds: [id], targetId, where } = event.detail;
    const library = this.#library();
    if (library === undefined || id === targetId || !this.editable) {
      return;
    }

    const beforeId = where === "above" ? targetId : library.findNextSibling(targetId);
    if (id !== beforeId) {
      this.#editing?.document.moveMaterial(
        id,
        library.get(targetId)?.parentId ?? null,
        beforeId
      );
    }
  };

  readonly handleActivate = (
    event: CustomEvent<JollyActivateDetail>
  ): void => {
    const { id } = event.detail;
    if (this.#material(id) !== undefined) {
      this.#expanded.toggle(id);
      this.#invalidate();
    }
  };

  openMenu(
    id: string | null
  ): MenuSession {
    const readOnly = !this.editable;
    if (id === null) {
      return MenuSession.from(
        disableEntries(ROOT_MENU, () => readOnly),
        (action, point) => this.#rootActions[action](point)
      );
    }
    if (this.#material(id) === undefined) {
      return MenuSession.EMPTY;
    }

    return MenuSession.forRow<MaterialRowAction>(
      disableEntries(MATERIAL_MENU, (action) => readOnly && action !== "copy"),
      () => this.#material(id) !== undefined,
      (action) => this.#rowActions[action](id)
    );
  }

  #deleteConfirmation(
    material: ModelMaterialJSON
  ): DeleteContext | null {
    const uses = this.#editing?.document.tree.blocksUsing(material.id).length ?? 0;

    return uses === 0 ?
      null :
      {
        heading: "Delete Material",
        hasChildren: false,
        message: `${material.name} is used by ${formatCount(uses, "block")}. ` +
          `${uses === 1 ? "It" : "They"} will have no material.`
      };
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
    const editing = this.#editing;
    const selected = editing?.selection.selected ?? null;

    return selected === null ? undefined : editing?.document.tree.block(selected);
  }

  #addAndAdopt(
    label: string | null,
    add: (document: ModelDocument) => string | null
  ): void {
    const editing = this.#editing;
    if (!this.editable) {
      return;
    }
    editing?.history.record("material", label, () => {
      const materialId = add(editing.document);
      if (materialId === null) {
        return;
      }

      this.select(materialId);
      if (this.#selectedBlock()?.materialId === undefined) {
        this.assign(materialId);
      }
    });
  }

  #followBlock(): void {
    const materialId = this.#selectedBlock()?.materialId ?? null;
    if (materialId !== null && this.#material(materialId) !== undefined) {
      this.#expanded.expand(materialId);
      this.#editing?.materialFocus.edit(materialId);
    }
  }

  #highlightedRow(): string | null {
    const edited = this.#editing?.materialFocus.edited ?? null;
    const block = this.#selectedBlock();

    return block !== undefined && edited !== null && block.materialId === edited ?
      usageRowId(block.id) :
      edited;
  }

  #invalidate(): void {
    this.#state = null;
    this.#host.requestUpdate();
  }

  #buildState(): MaterialLibraryState {
    const editing = this.#editing;
    const tree = editing?.document.tree;

    return {
      nodes: toMaterialTreeNodes({
        materials: [...tree?.materials.materials() ?? []],
        users: materialUsers(tree?.blocks() ?? []),
        marks: editing?.presence.materialEdits ?? new Map(),
        blockMarks: editing?.presence.blockSelections ?? new Map()
      }),
      selectedId: this.#highlightedRow(),
      editedId: editing?.materialFocus.edited ?? null,
      expanded: this.#expanded.ids,
      block: this.#blockState()
    };
  }

  #blockState(): SelectedBlockState | null {
    const block = this.#selectedBlock();
    if (block === undefined) {
      return null;
    }

    return {
      name: block.name,
      materialId: this.#material(block.materialId ?? null)?.id ?? null
    };
  }

  #library(): ModelMaterialsReader | undefined {
    return this.#editing?.document.tree.materials;
  }

  #material(
    materialId: string | null
  ): ModelMaterialJSON | undefined {
    return materialId === null ?
      undefined :
      this.#library()?.material(materialId);
  }

  #subscribeTo(
    editing: MaterialEditing
  ): Array<() => void> {
    const {
      access,
      document,
      selection,
      presence
    } = editing;

    return [
      access.subscribe("change", () => this.#invalidate()),
      document.subscribe("change", this.#onChange),
      document.subscribe("reset", this.#onReset),
      selection.subscribe("select", this.#onSelectBlock),
      presence.subscribe("materialEditsChange", this.#onPeerMarks),
      presence.subscribe("blockSelectionsChange", this.#onPeerMarks),
      () => editing.materialFocus.edit(null)
    ];
  }
}

function isUsageRow(
  rowId: string
): boolean {
  return blockOfUsageRow(rowId) !== null;
}

function materialUsers(
  blocks: Iterable<BlockNodeJSON>
): Map<string, MaterialUser[]> {
  const users = new Map<string, MaterialUser[]>();
  for (const { id, name, materialId } of blocks) {
    if (materialId) {
      const list = users.get(materialId) ?? [];
      list.push({ id, name });
      users.set(materialId, list);
    }
  }

  return users;
}
