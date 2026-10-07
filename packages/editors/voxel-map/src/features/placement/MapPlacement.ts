// Import Third-party Dependencies
import {
  VoxelTransform,
  type VoxelCoord,
  type VoxelHistory,
  type VoxelPatch,
  type VoxelTransformOptions,
  type VoxelWorld
} from "@jolly-pixel/voxel.renderer";
import { Emitter } from "@openally/emitt";

// Import Internal Dependencies
import type { MapDocumentSignals } from "../../document/MapDocument.ts";
import type { SelectionStore } from "../../state/index.ts";
import { ActivePlacement } from "./ActivePlacement.ts";
import type { CellRegion } from "./CellRegion.ts";
import { CopySource } from "./CopySource.ts";
import { Placement } from "./Placement.ts";
import { PlacementClipboard } from "./PlacementClipboard.ts";
import {
  LayerSource,
  TemplateSource,
  type PlacementSource
} from "./PlacementSource.ts";
import { RegionSource } from "./RegionSource.ts";

export type LayerConcealer = (layerName: string) => () => void;

export type MapPlacementEvents = {
  change: (
    current: ActivePlacement | null
  ) => void;
};

export interface MapPlacementOptions {
  world: VoxelWorld;
  history: Pick<VoxelHistory, "begin" | "commit">;
  selection: Pick<SelectionStore, "lastVoxelLayer" | "subscribe">;
  mapDocument: MapDocumentSignals;
  conceal?: LayerConcealer;
  clipboard?: PlacementClipboard;
}

export class MapPlacement {
  readonly clipboard: PlacementClipboard;

  readonly #world: VoxelWorld;
  readonly #history: Pick<VoxelHistory, "begin" | "commit">;
  readonly #selection: Pick<SelectionStore, "lastVoxelLayer">;
  readonly #conceal: LayerConcealer | null;
  readonly #events = new Emitter<MapPlacementEvents>();
  readonly #subscriptions: Array<() => void>;

  #placement: Placement | null = null;
  #lifted: RegionSource | null = null;
  #announced: ActivePlacement | null = null;
  #concealed: {
    layerName: string;
    release: () => void;
  } | null = null;

  constructor(
    options: MapPlacementOptions
  ) {
    this.#world = options.world;
    this.#history = options.history;
    this.#selection = options.selection;
    this.#conceal = options.conceal ?? null;
    this.clipboard = options.clipboard ?? new PlacementClipboard();

    const { mapDocument } = options;
    this.#subscriptions = [
      mapDocument.subscribe("layerUpdated", this.#refresh),
      mapDocument.subscribe("templatesChanged", this.#refresh),
      mapDocument.subscribe("reset", this.#refresh),
      mapDocument.subscribe("reset", () => {
        this.clipboard.content = null;
      }),
      options.selection.subscribe("change", this.#refresh)
    ];
  }

  get current(): ActivePlacement | null {
    const placement = this.#placement;
    const template = placement?.source.resolve(this.#world);
    if (
      placement === null ||
      template === undefined
    ) {
      return null;
    }

    return new ActivePlacement(
      placement,
      template,
      this.#targetOf(placement.source)
    );
  }

  get placing(): boolean {
    return this.current !== null;
  }

  get lifted(): RegionSource | null {
    return this.#lifted;
  }

  subscribe(
    event: "change",
    listener: MapPlacementEvents["change"]
  ): () => void {
    return this.#events.subscribe(event, listener);
  }

  placeTemplate(
    templateId: string,
    position: VoxelCoord
  ): boolean {
    if (this.#world.templates.get(templateId) === undefined) {
      return false;
    }
    this.#assign(
      Placement.at(
        new TemplateSource(templateId),
        position
      )
    );

    return true;
  }

  transformLayer(
    layerName: string
  ): boolean {
    const source = LayerSource.capture(
      this.#world,
      layerName
    );
    if (source === null) {
      return false;
    }

    this.#assign(
      Placement.at(
        source,
        source.pivot
      )
    );

    return true;
  }

  liftRegion(
    layerName: string,
    region: CellRegion
  ): boolean {
    this.cancel();

    return this.#lift(
      RegionSource.capture(
        this.#world,
        layerName,
        region
      )
    );
  }

  liftConnected(
    layerName: string,
    start: VoxelCoord
  ): boolean {
    this.cancel();

    return this.#lift(
      RegionSource.captureConnected(
        this.#world,
        layerName,
        start
      )
    );
  }

  transforming(
    layerName: string
  ): boolean {
    const source = this.#placement?.source;

    return source?.kind === "layer" && source.layerName === layerName;
  }

  move(
    position: VoxelCoord
  ): void {
    if (this.#placement !== null) {
      this.#assign(
        this.#placement.movedTo(position)
      );
    }
  }

  moveBoundsTo(
    min: VoxelCoord
  ): void {
    const current = this.current;
    if (current !== null) {
      this.#assign(
        current.placement.movedTo(
          current.positionFor(min)
        )
      );
    }
  }

  turn(
    transform: VoxelTransformOptions
  ): void {
    const current = this.current;
    if (current === null) {
      return;
    }

    const { placement, template } = current;
    this.#assign(
      (transform.rotation ?? 0) % 4 === 0 ?
        placement.mirroredIn(template, transform) :
        placement.turnedBy(transform)
    );
  }

  commit(): boolean {
    const current = this.current;
    if (
      current === null ||
      current.target === null
    ) {
      return false;
    }

    const { placement, target } = current;
    const { source } = placement;
    this.#history.begin();
    let committed = false;
    try {
      switch (source.kind) {
        case "template":
          committed = this.#world.templates.place(source.templateId, {
            layerName: target,
            position: placement.position,
            transform: placement.transform
          });
          break;
        case "layer":
          committed = this.#moveLayer(placement, source);
          break;
        case "region":
          committed = this.#putBack() && this.#patch(
            source.layerName,
            source.movePatch(placement)
          );
          break;
        case "copy":
          committed = this.#patch(target, source.placePatch(placement));
          break;
      }
    }
    finally {
      this.#history.commit();
    }
    if (committed) {
      this.#end();
    }

    return committed;
  }

  deleteRegion(): boolean {
    const lifted = this.#lifted;
    if (lifted === null || !this.#putBack()) {
      return false;
    }

    this.#patch(lifted.layerName, lifted.erasePatch());
    this.#end();

    return true;
  }

  copy(): boolean {
    const current = this.current;
    if (current === null) {
      return false;
    }

    this.clipboard.content = current.template.transformed(
      current.placement.transform
    );

    return true;
  }

  paste(
    position: VoxelCoord
  ): boolean {
    const content = this.clipboard.content;
    if (content === null) {
      return false;
    }
    if (this.#lifted !== null) {
      this.commit();
    }
    this.#assign(
      Placement.at(
        CopySource.of(content),
        position
      )
    );

    return true;
  }

  cancelLift(): boolean {
    return this.#lifted !== null && this.cancel();
  }

  cancel(): boolean {
    const placing = this.#placement !== null;
    this.#end();

    return placing;
  }

  dispose(): void {
    this.#putBack();
    for (const unsubscribe of this.#subscriptions.splice(0)) {
      unsubscribe();
    }
    this.#release();
  }

  #targetOf(
    source: PlacementSource
  ): string | null {
    return source.kind === "template" || source.kind === "copy" ?
      this.#selection.lastVoxelLayer :
      source.layerName;
  }

  #lift(
    source: RegionSource | null
  ): boolean {
    if (source === null) {
      return false;
    }

    this.#world.unrecorded(
      () => this.#patch(source.layerName, source.erasePatch())
    );
    this.#lifted = source;
    this.#assign(
      Placement.at(
        source,
        source.pivot
      )
    );

    return true;
  }

  #patch(
    layerName: string,
    patch: VoxelPatch
  ): boolean {
    if (this.#world.getLayer(layerName) === undefined) {
      return false;
    }

    this.#world.patchVoxels(
      layerName,
      patch.cells,
      patch.partners
    );

    return true;
  }

  #putBack(): boolean {
    const lifted = this.#lifted;
    if (lifted === null) {
      return false;
    }

    this.#lifted = null;

    return this.#world.unrecorded(
      () => this.#patch(lifted.layerName, lifted.restorePatch())
    );
  }

  #assign(
    placement: Placement
  ): void {
    if (!placement.equals(this.#placement)) {
      this.#placement = placement;
      this.#refresh();
    }
  }

  #end(): void {
    if (this.#placement !== null) {
      this.#placement = null;
      this.#refresh();
    }
  }

  readonly #refresh = (): void => {
    const current = this.current;
    if (current === null) {
      this.#placement = null;
    }
    if (
      this.#lifted !== null &&
      this.#placement?.source !== this.#lifted
    ) {
      this.#putBack();
    }

    const announced = this.#announced;
    const unchanged = current === null ?
      announced === null :
      current.equals(announced);
    if (unchanged) {
      return;
    }

    this.#announced = current;
    this.#syncConcealed(current);
    this.#events.emit("change", current);
  };

  #moveLayer(
    placement: Placement,
    source: LayerSource
  ): boolean {
    const { layerName } = source;
    if (this.#world.getLayer(layerName) === undefined) {
      return false;
    }

    if (!placement.transform.equals(VoxelTransform.Identity)) {
      this.#world.transformLayer(
        layerName,
        placement.transform
      );
    }

    const bounds = this.#world.getLayer(layerName)?.worldBounds() ?? null;
    if (bounds === null) {
      return true;
    }

    const { min } = placement.boundsIn(source.snapshot);
    const delta = {
      x: min.x - bounds.min.x,
      y: min.y - bounds.min.y,
      z: min.z - bounds.min.z
    };
    if (delta.x !== 0 || delta.y !== 0 || delta.z !== 0) {
      this.#world.translateLayer(layerName, delta);
    }

    return true;
  }

  #syncConcealed(
    current: ActivePlacement | null
  ): void {
    const source = current?.placement.source;
    const layerName = source?.kind === "layer" ? source.layerName : null;
    if (this.#concealed?.layerName === layerName) {
      return;
    }

    this.#release();
    if (layerName !== null && this.#conceal !== null) {
      this.#concealed = {
        layerName,
        release: this.#conceal(layerName)
      };
    }
  }

  #release(): void {
    this.#concealed?.release();
    this.#concealed = null;
  }
}
