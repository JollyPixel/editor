// Import Third-party Dependencies
import {
  Actor,
  ActorComponent
} from "@jolly-pixel/engine";
import * as THREE from "three";

// Import Internal Dependencies
import {
  VoxelDocument,
  type VoxelDocumentOptions
} from "../../document/VoxelDocument.ts";
import {
  VoxelView,
  type VoxelViewOptions
} from "../../view/VoxelView.ts";

export interface VoxelRendererOptions extends VoxelViewOptions {
  /**
   * Document to draw. Given as options, or omitted, the renderer builds its
   * own document and disposes it when destroyed; a given document is left to
   * its owner.
   */
  document?: VoxelDocument | VoxelDocumentOptions;

  /**
   * Object whose world position prioritizes chunk rebuilds.
   * Sampled each update; `null` preserves `view.focus`.
   * @default null
   */
  focus?: THREE.Object3D | null;
}

/**
 * Runs a `VoxelView` through the actor component lifecycle.
 */
export class VoxelRenderer extends ActorComponent {
  readonly document: VoxelDocument;
  readonly view: VoxelView;

  focus: THREE.Object3D | null;

  #ownsDocument: boolean;
  #focusPoint = new THREE.Vector3();

  constructor(
    actor: Actor<any>,
    options: VoxelRendererOptions = {}
  ) {
    super({
      actor,
      typeName: "VoxelRenderer"
    });

    const {
      focus = null,
      document = {},
      logger = actor.world.logger,
      requestFrame,
      ...viewOptions
    } = options;

    this.focus = focus;
    this.#ownsDocument = !(document instanceof VoxelDocument);
    this.document = document instanceof VoxelDocument ?
      document :
      new VoxelDocument({ logger, ...document });
    this.view = new VoxelView(this.document, {
      ...viewOptions,
      logger,
      requestFrame: () => {
        actor.world.invalidate();
        requestFrame?.();
      }
    });
    this.addTeardown(
      actor.world.keepAlive(
        () => this.view.pendingRebuilds > 0
      )
    );
  }

  awake(): void {
    this.actor.object3D.add(this.view.root);
    this.view.init();
  }

  update(
    deltaTime: number
  ): void {
    this.#sampleFocus();
    this.view.tick(deltaTime);
  }

  #sampleFocus(): void {
    if (this.focus === null) {
      return;
    }

    this.focus.getWorldPosition(this.#focusPoint);
    this.view.root.worldToLocal(this.#focusPoint);
    this.view.focus = this.#focusPoint;
  }

  override destroy(): void {
    this.actor.object3D.remove(this.view.root);
    this.view.dispose();
    if (this.#ownsDocument) {
      this.document.dispose();
    }

    super.destroy();
  }
}
