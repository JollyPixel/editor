// Import Third-party Dependencies
import type {
  VoxelTemplate,
  VoxelWorld
} from "@jolly-pixel/voxel.renderer";
import type { CommandHistory } from "@jolly-pixel/history";
import type { CameraPose } from "@jolly-pixel/engine";
import {
  showConfirm,
  type LogQueue
} from "@jolly-pixel/ui";
import type { Box3 } from "three";

// Import Internal Dependencies
import type { MapDocumentSignals } from "../../../document/MapDocument.ts";
import { TemplateDraftId } from "../../../document/TemplateDraftId.ts";
import type { MapAccessSource } from "../../../access/MapAccess.ts";
import {
  TEMPLATE_HISTORY_SCOPE,
  type MapHistoryScope
} from "../../../shared/mapHistory.ts";
import {
  VoxelLayerRef,
  type EditContext,
  type LayerRef,
  type PresenceStore,
  type SelectionStore
} from "../../../state/index.ts";
import type { MapPlacement } from "../../placement/MapPlacement.ts";
import { TemplateDraft } from "./TemplateDraft.ts";

export interface TemplateEditCamera {
  pose(): CameraPose;
  teleport(pose: CameraPose): void;
  frame(bounds: Box3 | null): void;
  exitFocus(): void;
}

export interface TemplateEditingOptions {
  world: VoxelWorld;
  context: EditContext;
  selection: SelectionStore;
  mapDocument: MapDocumentSignals;
  access: MapAccessSource;
  isolate: (layerName: string) => () => void;
  camera: TemplateEditCamera;
  history: Pick<CommandHistory<MapHistoryScope>, "removeScope">;
  placement: Pick<MapPlacement, "cancel">;
  presence: Pick<PresenceStore, "layerSelections">;
  log: Pick<LogQueue, "push">;
  confirm?: typeof showConfirm;
}

export interface TemplateEditSession {
  readonly template: VoxelTemplate;
  readonly draft: TemplateDraft;
}

interface MapView {
  pose: CameraPose;
  selection: LayerRef | null;
  release: () => void;
}

export class TemplateEditing {
  readonly #world: VoxelWorld;
  readonly #context: EditContext;
  readonly #selection: SelectionStore;
  readonly #access: MapAccessSource;
  readonly #isolate: (layerName: string) => () => void;
  readonly #camera: TemplateEditCamera;
  readonly #history: Pick<CommandHistory<MapHistoryScope>, "removeScope">;
  readonly #placement: Pick<MapPlacement, "cancel">;
  readonly #presence: Pick<PresenceStore, "layerSelections">;
  readonly #log: Pick<LogQueue, "push">;
  readonly #confirm: typeof showConfirm;
  readonly #subscriptions: Array<() => void>;

  #mapView: MapView | null = null;

  constructor(
    options: TemplateEditingOptions
  ) {
    this.#world = options.world;
    this.#context = options.context;
    this.#selection = options.selection;
    this.#access = options.access;
    this.#isolate = options.isolate;
    this.#camera = options.camera;
    this.#history = options.history;
    this.#placement = options.placement;
    this.#presence = options.presence;
    this.#log = options.log;
    this.#confirm = options.confirm ?? showConfirm;

    const { mapDocument } = options;
    this.#subscriptions = [
      mapDocument.subscribe("layerUpdated", this.#reconcile),
      mapDocument.subscribe("templatesChanged", this.#reconcile),
      mapDocument.subscribe("reset", this.#reconcile)
    ];
  }

  get canOpen(): boolean {
    const { current } = this.#access;

    return current.has("templates") &&
      current.has("layers") &&
      current.has("voxels");
  }

  get canApply(): boolean {
    return this.#access.current.has("templates");
  }

  get canDiscard(): boolean {
    return this.#access.current.has("layers");
  }

  get current(): TemplateEditSession | null {
    const templateId = this.#context.draft?.templateId;
    if (templateId === undefined) {
      return null;
    }

    const template = this.#world.templates.get(templateId);
    const draft = TemplateDraft.find(this.#world, templateId);

    return template === undefined || draft === null ?
      null :
      {
        template,
        draft
      };
  }

  open(
    templateId: string
  ): boolean {
    const template = this.#world.templates.get(templateId);
    if (!this.canOpen || template === undefined) {
      return false;
    }
    if (this.#context.draft?.templateId === templateId) {
      return true;
    }

    this.#end();
    this.#placement.cancel();
    const draft = TemplateDraft.open(this.#world, template);
    this.#mapView = {
      pose: this.#camera.pose(),
      selection: this.#selection.current,
      release: this.#isolate(draft.layerName)
    };
    this.#context.draft = new TemplateDraftId(templateId);
    this.#selection.selectVoxelLayer(draft.layerName);
    this.#camera.frame(draft.layer.worldBounds());

    return true;
  }

  apply(): boolean {
    const session = this.current;
    if (session === null || !this.canApply) {
      return false;
    }

    const { template, draft } = session;
    if (draft.empty) {
      this.#log.push(
        `"${template.name}" has no voxels left: paint some or delete the template`
      );

      return false;
    }
    if (draft.matches(template)) {
      return false;
    }

    const applied = this.#world.templates.createFromLayer(draft.layerName, {
      id: template.id,
      name: template.name,
      pivot: draft.pivot,
      properties: { ...template.properties }
    });

    return applied !== undefined;
  }

  close(): boolean {
    const session = this.current;
    if (session === null) {
      return false;
    }

    const { template, draft } = session;
    const unchanged = draft.matches(template);
    this.#end();
    if (!unchanged) {
      this.#log.push(
        `Kept the draft of "${template.name}": edit the template again to apply or discard it`
      );
    }
    else if (this.#peersIn(draft) === 0 && this.canDiscard) {
      draft.removeFrom(this.#world);
    }

    return true;
  }

  async discard(): Promise<boolean> {
    const session = this.current;
    if (session === null || !this.canDiscard) {
      return false;
    }

    const { template, draft } = session;
    const confirmed = await this.#confirm({
      title: "Discard draft",
      message: [
        `Discard the changes made to "${template.name}" since it was last applied?`,
        "Everyone editing it leaves the template."
      ].join(" "),
      confirmLabel: "Discard",
      icon: "trash",
      danger: true
    });
    if (!confirmed || this.#context.draft?.templateId !== template.id) {
      return false;
    }

    this.#end();
    draft.removeFrom(this.#world);

    return true;
  }

  dispose(): void {
    for (const unsubscribe of this.#subscriptions.splice(0)) {
      unsubscribe();
    }
    this.#end();
  }

  #peersIn(
    draft: TemplateDraft
  ): number {
    const key = new VoxelLayerRef(draft.layerName).key;

    return this.#presence.layerSelections.get(key)?.length ?? 0;
  }

  #end(): void {
    const mapView = this.#mapView;
    if (mapView === null) {
      return;
    }

    this.#mapView = null;
    this.#placement.cancel();
    this.#history.removeScope(TEMPLATE_HISTORY_SCOPE);
    this.#context.draft = null;
    mapView.release();
    if (mapView.selection?.exists(this.#world) === true) {
      this.#selection.current = mapView.selection;
    }
    this.#camera.exitFocus();
    this.#camera.teleport(mapView.pose);
  }

  readonly #reconcile = (): void => {
    if (this.#mapView === null || this.current !== null) {
      return;
    }

    this.#end();
    this.#log.push("Left the template: it or its draft was removed");
  };
}
