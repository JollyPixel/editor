// Import Third-party Dependencies
import type * as THREE from "three/webgpu";
import {
  ActorComponent,
  type Actor
} from "@jolly-pixel/engine";
import {
  MeshHighlight,
  ObjectOverlayRenderer,
  PeerHighlights,
  createListedColorAllocator
} from "@jolly-pixel/three";
import {
  reconcilePeerMarks,
  type PeerMarkMap
} from "@jolly-pixel/ui/network";

// Import Internal Dependencies
import type { SceneBinding } from "../../scene/SceneBinding.ts";
import type { PresenceStore } from "../../state/PresenceStore.ts";
import type { SelectionStore } from "../../state/SelectionStore.ts";

// CONSTANTS
const kSelectionColor = "#f5c46b";

export interface SelectionHighlightOptions {
  renderer: THREE.WebGPURenderer;
  camera: THREE.Camera;
  binding: Pick<SceneBinding, "actor" | "subscribe">;
  selection: SelectionStore;
  presence: PresenceStore;
}

export class SelectionHighlight extends ActorComponent {
  #options: SelectionHighlightOptions;
  #highlight: MeshHighlight;
  #targets = new Map<string, THREE.Object3D>();
  #peerTargets = new Map<string, string>();

  #sync = (): void => {
    const { selection, presence } = this.#options;
    const highlight = this.#highlight;
    const targets = this.#wantedTargets();
    for (const [id, object] of this.#targets) {
      if (targets.get(id) !== object) {
        highlight.unregister(id);
      }
    }
    for (const [id, object] of targets) {
      if (this.#targets.get(id) !== object) {
        highlight.register(id, object);
      }
    }
    this.#targets = targets;

    const [primary = null, ...others] = selection.ids.filter(
      (id) => targets.has(id)
    );
    highlight.select(primary);
    highlight.emphasize(others);
    this.#peerTargets = reconcilePeerMarks(
      targetedMarks(presence.selections, targets),
      this.#peerTargets,
      {
        hold: (peer, id) => highlight.peers.select(peer.clientId, id),
        release: (clientId) => highlight.peers.select(clientId, null)
      }
    );
    this.actor.world.invalidate();
  };

  constructor(
    actor: Actor,
    options: SelectionHighlightOptions
  ) {
    super({
      actor,
      typeName: "SelectionHighlight"
    });
    this.#options = options;

    const { binding, selection, presence } = options;
    this.#highlight = new MeshHighlight({
      renderer: options.renderer,
      scene: actor.world.sceneManager.getSource(),
      camera: options.camera,
      mode: "outline",
      rendererFactory: ({ camera, overlayRegistry }) => new ObjectOverlayRenderer({
        registry: overlayRegistry,
        camera
      }),
      chips: true,
      appearance: {
        xray: true,
        selected: { color: kSelectionColor },
        hovered: { color: kSelectionColor }
      },
      peers: new PeerHighlights({
        colorAllocator: createListedColorAllocator(() => presence.peers)
      })
    });

    const subscriptions = [
      selection.subscribe("change", this.#sync),
      presence.subscribe("selectionsChange", this.#sync),
      binding.subscribe("actorsChange", this.#sync)
    ];
    this.addTeardown(() => {
      for (const unsubscribe of subscriptions) {
        unsubscribe();
      }
      this.#highlight.dispose();
    });
    this.#sync();
  }

  update(): void {
    this.#highlight.update();
    this.#highlight.render();
  }

  #wantedTargets(): Map<string, THREE.Object3D> {
    const { binding, selection, presence } = this.#options;
    const targets = new Map<string, THREE.Object3D>();
    for (const id of [...selection.ids, ...presence.selections.keys()]) {
      const actor = binding.actor(id);
      if (actor !== null) {
        targets.set(id, actor.object3D);
      }
    }

    return targets;
  }
}

function targetedMarks(
  marks: PeerMarkMap<string>,
  targets: ReadonlyMap<string, THREE.Object3D>
): PeerMarkMap<string> {
  return new Map(
    [...marks].filter(([id]) => targets.has(id))
  );
}
