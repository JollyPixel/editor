// Import Third-party Dependencies
import type { ReactiveControllerHost } from "lit";
import { SubscriptionController } from "@jolly-pixel/ui";
import {
  frameAt,
  trackBlockName,
  type AnimationInterpolation
} from "@jolly-pixel/asset.voxel-animation/client";

// Import Internal Dependencies
import type { AnimationSession } from "./AnimationSession.ts";
import type { KeyEditor } from "./KeyEditor.ts";

export interface KeyInspectorWorkspace {
  animationSession: AnimationSession;
  keyEditor: KeyEditor;
}

export interface KeyInspectorState {
  title: string;
  interpolation: AnimationInterpolation | "mixed";
}

export class KeyInspectorController {
  #host: ReactiveControllerHost;
  #state: KeyInspectorState | null = null;
  #connection: SubscriptionController<KeyInspectorWorkspace>;

  constructor(
    host: ReactiveControllerHost
  ) {
    this.#host = host;
    this.#connection = new SubscriptionController(host, ({ animationSession, keyEditor }) => [
      animationSession.subscribe("clip", this.#refresh),
      keyEditor.subscribe("change", this.#refresh)
    ]);
  }

  get state(): KeyInspectorState | null {
    return this.#state;
  }

  attach(
    workspace: KeyInspectorWorkspace
  ): void {
    this.#connection.attach(workspace);
    this.#refresh();
  }

  setInterpolation(
    interpolation: AnimationInterpolation
  ): void {
    this.#connection.current?.keyEditor.setInterpolation(interpolation);
  }

  readonly #refresh = (): void => {
    this.#state = this.#build();
    this.#host.requestUpdate();
  };

  #build(): KeyInspectorState | null {
    const workspace = this.#connection.current;
    const clip = workspace?.animationSession.focused?.clip;
    const interpolation = workspace?.keyEditor.interpolation ?? null;
    if (workspace === null || clip === undefined || interpolation === null) {
      return null;
    }

    const refs = workspace.keyEditor.selected;
    const [first] = refs;

    return {
      title: refs.length === 1 ?
        `${trackBlockName(first.path)} @ frame ${frameAt(first.tick, clip.fps)}` :
        `${refs.length} keys`,
      interpolation
    };
  }
}
