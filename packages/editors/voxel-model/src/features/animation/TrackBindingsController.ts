// Import Third-party Dependencies
import type { ReactiveControllerHost } from "lit";
import { SubscriptionController } from "@jolly-pixel/ui";

// Import Internal Dependencies
import type { AnimationLibrary } from "./AnimationLibrary.ts";
import {
  trackBindingRows,
  type TrackBindingRow
} from "./trackBindingRows.ts";
import {
  rebindMenu,
  remapTrack,
  type TrackRebindWorkspace
} from "./trackRebind.ts";
import type { AnimationFocusStore } from "../../state/index.ts";
import type {
  MenuPoint,
  MenuSession
} from "../../shared/menuSession.ts";

export interface TrackBindingsWorkspace extends TrackRebindWorkspace {
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
}

export class TrackBindingsController {
  #host: ReactiveControllerHost;
  #view: TrackBindingsView;
  #state: TrackBindingsState | null = null;
  #connection: SubscriptionController<TrackBindingsWorkspace>;

  constructor(
    host: ReactiveControllerHost,
    view: TrackBindingsView
  ) {
    this.#host = host;
    this.#view = view;
    this.#connection = new SubscriptionController(host, ({ document, animations, animationFocus }) => [
      document.subscribe("change", this.#refresh),
      document.subscribe("reset", this.#refresh),
      animations.subscribe("change", this.#refresh),
      animationFocus.subscribe("change", this.#refresh)
    ]);
  }

  get state(): TrackBindingsState | null {
    return this.#state;
  }

  attach(
    workspace: TrackBindingsWorkspace
  ): void {
    this.#connection.attach(workspace);
    this.#refresh();
  }

  rebind(
    path: string,
    point: MenuPoint
  ): void {
    this.#withFocusedSet((workspace, setId) => {
      this.#view.openMenu(rebindMenu(workspace, setId, path), point);
    });
  }

  ignore(
    path: string
  ): void {
    this.#withFocusedSet((workspace, setId) => remapTrack(workspace, setId, path, null));
  }

  reset(
    path: string
  ): void {
    this.#withFocusedSet((workspace, setId) => {
      workspace.history.record(
        "animate",
        `Reset ${path}`,
        () => workspace.document.clearAnimationTrackRemap(setId, path)
      );
    });
  }

  #withFocusedSet(
    use: (workspace: TrackBindingsWorkspace, setId: string) => void
  ): void {
    const workspace = this.#connection.current;
    const setId = workspace?.animationFocus.focus.setId ?? null;
    if (workspace !== null && setId !== null) {
      use(workspace, setId);
    }
  }

  readonly #refresh = (): void => {
    this.#state = this.#build();
    this.#host.requestUpdate();
  };

  #build(): TrackBindingsState | null {
    const workspace = this.#connection.current;
    const setId = workspace?.animationFocus.focus.setId ?? null;
    if (workspace === null || setId === null) {
      return null;
    }

    const set = workspace.animations.set(setId);
    const link = workspace.document.tree.animationSets.get(setId);
    if (set === undefined || link === undefined) {
      return null;
    }

    return {
      setName: set.own ? "this model" : set.name,
      rows: trackBindingRows(set.document.set, link, workspace.document.tree)
    };
  }
}
