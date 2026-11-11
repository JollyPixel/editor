// Import Third-party Dependencies
import type * as THREE from "three/webgpu";
import {
  ActorComponent,
  type Actor
} from "@jolly-pixel/engine";
import type { Preferences } from "@jolly-pixel/preferences";
import {
  MeshHighlight,
  ObjectOverlayRenderer,
  PeerHighlights,
  createListedColorAllocator,
  type HighlightTechnique
} from "@jolly-pixel/three";
import { PeerMarkSync } from "@jolly-pixel/ui";

// Import Internal Dependencies
import { SCENE_PREFERENCES } from "../../preferences.ts";
import type { SceneBinding } from "../../scene/SceneBinding.ts";
import type { PresenceStore } from "../../state/PresenceStore.ts";
import type { SelectionStore } from "../../state/SelectionStore.ts";

// CONSTANTS
const kSelectionColor = "#f5c46b";
const kOutlineThickness = 0.04;
const kOccludedOpacityScale = 0.25;

export interface SelectionHighlightOptions {
  renderer: THREE.WebGPURenderer;
  camera: THREE.Camera;
  binding: Pick<SceneBinding, "actor" | "subscribe">;
  selection: SelectionStore;
  presence: PresenceStore;
  preferences: Preferences;
}

export class SelectionHighlight extends ActorComponent {
  #options: SelectionHighlightOptions;
  #highlight: MeshHighlight;
  #targets = new Map<string, THREE.Object3D>();
  #technique: HighlightTechnique;
  #peerTargets: PeerMarkSync<string>;

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
        highlight.register(id, object, { technique: this.#technique });
      }
    }
    this.#targets = targets;

    const [primary = null, ...others] = selection.ids.filter(
      (id) => targets.has(id)
    );
    highlight.select(primary);
    highlight.emphasize(others);
    this.#peerTargets.apply(
      presence.selections.filter((id) => targets.has(id))
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

    const { binding, selection, presence, preferences } = options;
    this.#technique = selectionTechnique(preferences.values(SCENE_PREFERENCES).bounds);
    this.#highlight = new MeshHighlight({
      renderer: options.renderer,
      scene: actor.world.sceneManager.graph.scene,
      camera: options.camera,
      mode: "outline",
      rendererFactory: ({ camera, overlayRegistry }) => new ObjectOverlayRenderer({
        registry: overlayRegistry,
        camera
      }),
      chips: true,
      appearance: {
        xray: true,
        xrayDepthWrite: true,
        selected: { color: kSelectionColor },
        hovered: { color: kSelectionColor },
        outline: { linewidth: kOutlineThickness },
        occludedOpacityScale: kOccludedOpacityScale
      },
      peers: new PeerHighlights({
        colorAllocator: createListedColorAllocator(() => presence.peers)
      })
    });
    const { peers } = this.#highlight;
    this.#peerTargets = new PeerMarkSync({
      hold: (peer, id) => peers.select(peer.clientId, id),
      release: (clientId) => peers.select(clientId, null)
    });

    const subscriptions = [
      selection.subscribe("change", this.#sync),
      presence.subscribe("selectionsChange", this.#sync),
      binding.subscribe("actorsChange", this.#sync),
      preferences.watch(SCENE_PREFERENCES, (values) => {
        const technique = selectionTechnique(values.bounds);
        if (technique !== this.#technique) {
          this.#technique = technique;
          for (const [id, object] of this.#targets) {
            this.#highlight.register(id, object, { technique });
          }
          actor.world.invalidate();
        }
      })
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
        targets.set(id, actor.node.object3D);
      }
    }

    return targets;
  }
}

function selectionTechnique(
  bounds: boolean
): HighlightTechnique {
  return bounds ? "boundingBox" : "silhouette";
}
