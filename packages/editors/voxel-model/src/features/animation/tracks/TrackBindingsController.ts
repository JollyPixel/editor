// Import Third-party Dependencies
import type { ReactiveControllerHost } from "lit";
import {
  SubscriptionController,
  type MenuPoint,
  type MenuSession
} from "@jolly-pixel/ui";
import type { ModelDocument } from "@jolly-pixel/asset.voxel-model/client";

// Import Internal Dependencies
import {
  toClipTarget,
  type AnimationLibrary
} from "../library/AnimationLibrary.ts";
import {
  trackBindingRows,
  type TrackBindingRow
} from "./trackBindingRows.ts";
import { rebindMenu } from "./trackRebind.ts";
import type { AnimationFocusStore } from "../../../state/index.ts";
import type { ModelAccessSignals } from "../../../access/ModelAccess.ts";

export interface TrackBindingsEditing {
  access: Pick<ModelAccessSignals, "subscribe">;
  document: ModelDocument;
  animations: AnimationLibrary;
  animationFocus: AnimationFocusStore;
}

export interface TrackBindingsView {
  openMenu(
    session: MenuSession,
    point: MenuPoint
  ): void;
}

export interface TrackBindingsState {
  setName: string;
  rows: TrackBindingRow[];
  editable: boolean;
}

export class TrackBindingsController {
  #host: ReactiveControllerHost;
  #view: TrackBindingsView;
  #state: TrackBindingsState | null = null;
  #connection: SubscriptionController<TrackBindingsEditing>;

  constructor(
    host: ReactiveControllerHost,
    view: TrackBindingsView
  ) {
    this.#host = host;
    this.#view = view;
    this.#connection = new SubscriptionController(host, (editing) => [
      editing.access.subscribe("change", this.#refresh),
      editing.document.subscribe("change", this.#refresh),
      editing.document.subscribe("reset", this.#refresh),
      editing.animations.subscribe("change", this.#refresh),
      editing.animationFocus.subscribe("change", this.#refresh)
    ]);
  }

  get state(): TrackBindingsState | null {
    return this.#state;
  }

  attach(
    editing: TrackBindingsEditing
  ): void {
    this.#connection.attach(editing);
    this.#refresh();
  }

  rebind(
    path: string,
    point: MenuPoint
  ): void {
    this.#withFocusedSet((editing, setId) => {
      this.#view.openMenu(rebindMenu(editing.document, setId, path), point);
    });
  }

  ignore(
    path: string
  ): void {
    this.#withFocusedSet((editing, setId) => {
      editing.document.remapAnimationTrack(setId, path, null);
    });
  }

  reset(
    path: string
  ): void {
    this.#withFocusedSet((editing, setId) => {
      editing.document.clearAnimationTrackRemap(setId, path);
    });
  }

  #withFocusedSet(
    use: (editing: TrackBindingsEditing, setId: string) => void
  ): void {
    const editing = this.#connection.current;
    const setId = editing?.animationFocus.focus.setId ?? null;
    if (editing !== null && setId !== null && editing.animations.editable) {
      use(editing, setId);
    }
  }

  readonly #refresh = (): void => {
    this.#state = this.#build();
    this.#host.requestUpdate();
  };

  #build(): TrackBindingsState | null {
    const editing = this.#connection.current;
    const setId = editing?.animationFocus.focus.setId ?? null;
    if (editing === null || setId === null) {
      return null;
    }

    const set = editing.animations.set(setId);
    const link = editing.document.tree.animationSets.get(setId);
    if (set === undefined || link === undefined) {
      return null;
    }

    return {
      setName: editing.animations.targetName(toClipTarget(set)),
      rows: trackBindingRows(set.document.set, link, editing.document.tree),
      editable: editing.animations.editable
    };
  }
}
