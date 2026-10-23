// Import Third-party Dependencies
import type { ReactiveControllerHost } from "lit";
import { SubscriptionController } from "@jolly-pixel/ui";
import {
  FrameRate,
  TrackPath,
  type AnimationInterpolation
} from "@jolly-pixel/asset.voxel-animation/client";

// Import Internal Dependencies
import type { AnimationSession } from "../session/AnimationSession.ts";
import type { KeyEditor } from "./KeyEditor.ts";
import type { ModelAccessSignals } from "../../../access/ModelAccess.ts";

export interface KeyInspectorEditing {
  access: Pick<ModelAccessSignals, "subscribe">;
  animationSession: AnimationSession;
  keyEditor: KeyEditor;
}

export interface KeyInspectorState {
  title: string;
  interpolation: AnimationInterpolation | "mixed";
  editable: boolean;
}

export class KeyInspectorController {
  #host: ReactiveControllerHost;
  #state: KeyInspectorState | null = null;
  #connection: SubscriptionController<KeyInspectorEditing>;

  constructor(
    host: ReactiveControllerHost
  ) {
    this.#host = host;
    this.#connection = new SubscriptionController(host, ({ access, animationSession, keyEditor }) => [
      access.subscribe("change", this.#refresh),
      animationSession.subscribe("clip", this.#refresh),
      keyEditor.subscribe("change", this.#refresh)
    ]);
  }

  get state(): KeyInspectorState | null {
    return this.#state;
  }

  attach(
    editing: KeyInspectorEditing
  ): void {
    this.#connection.attach(editing);
    this.#refresh();
  }

  applyInterpolation(
    interpolation: AnimationInterpolation
  ): void {
    this.#connection.current?.keyEditor.applyInterpolation(interpolation);
  }

  readonly #refresh = (): void => {
    this.#state = this.#build();
    this.#host.requestUpdate();
  };

  #build(): KeyInspectorState | null {
    const editing = this.#connection.current;
    const clip = editing?.animationSession.focused?.clip;
    const interpolation = editing?.keyEditor.interpolation ?? null;
    if (editing === null || clip === undefined || interpolation === null) {
      return null;
    }

    const refs = editing.keyEditor.selected;
    const [first] = refs;

    return {
      title: refs.length === 1 ?
        `${new TrackPath(first.path).blockName} @ frame ${new FrameRate(clip.fps).frameAt(first.tick)}` :
        `${refs.length} keys`,
      interpolation,
      editable: editing.keyEditor.editable
    };
  }
}
