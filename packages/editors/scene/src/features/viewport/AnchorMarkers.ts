// Import Third-party Dependencies
import type * as THREE from "three";
import {
  ActorComponent,
  type Actor,
  type Systems
} from "@jolly-pixel/engine";

// Import Internal Dependencies
import type { SceneBinding } from "../../scene/SceneBinding.ts";
import {
  actorAnchor,
  actorAnchorKey,
  type ActorAnchor
} from "../../state/AnchorPicks.ts";
import type { SelectionStore } from "../../state/SelectionStore.ts";
import { AnchorMarker } from "./helpers/AnchorMarker.ts";

// CONSTANTS
const kMarkerColor = "#6bc4f5";
const kHangingColor = "#f5c46b";
const kPickRadius = 0.25;

export interface AnchorMarkersOptions {
  live: Pick<
    SceneBinding,
    "actor" | "actorEntry" | "anchors" | "findAnchor" | "subscribe"
  >;
  selection: Pick<SelectionStore, "ids" | "subscribe">;
}

interface ShownAnchor {
  picked: ActorAnchor;
  anchor: Systems.ComponentAnchor;
  hanging: boolean;
}

interface DrawnAnchor extends ShownAnchor {
  marker: AnchorMarker;
}

export class AnchorMarkers extends ActorComponent {
  #options: AnchorMarkersOptions;
  #scene: THREE.Scene;
  #drawn: DrawnAnchor[] = [];

  #sync = (): void => {
    this.#clear();
    for (const shown of this.#wanted()) {
      const drawn = {
        ...shown,
        marker: new AnchorMarker(shown.hanging ? kHangingColor : kMarkerColor)
      };
      this.#drawn.push(drawn);
      this.#scene.add(drawn.marker.root);
      this.#place(drawn);
    }
    this.actor.world.invalidate();
  };

  constructor(
    actor: Actor,
    options: AnchorMarkersOptions
  ) {
    super({
      actor,
      typeName: "AnchorMarkers"
    });
    this.#options = options;
    this.#scene = actor.world.sceneManager.getSource();

    const { live, selection } = options;
    const subscriptions = [
      selection.subscribe("change", this.#sync),
      live.subscribe("anchorsChange", this.#sync),
      live.subscribe("actorsChange", this.#sync)
    ];
    this.addTeardown(() => {
      for (const unsubscribe of subscriptions) {
        unsubscribe();
      }
      this.#clear();
    });
    this.#sync();
  }

  update(): void {
    for (const drawn of this.#drawn) {
      this.#place(drawn);
    }
  }

  pick(
    ray: THREE.Ray
  ): ActorAnchor | null {
    let closest: ActorAnchor | null = null;
    let closestDistance = Infinity;
    for (const { picked, marker } of this.#drawn) {
      const { position } = marker.root;
      if (
        !marker.root.visible ||
        ray.distanceSqToPoint(position) > kPickRadius ** 2
      ) {
        continue;
      }

      const distance = ray.origin.distanceTo(position);
      if (distance < closestDistance) {
        closest = picked;
        closestDistance = distance;
      }
    }

    return closest;
  }

  #place(
    drawn: DrawnAnchor
  ): void {
    const owner = this.#options.live.actor(drawn.picked.ownerId);
    drawn.marker.root.visible = owner?.transform.visibleInHierarchy ?? false;
    if (owner !== null) {
      owner.object3D.updateWorldMatrix(true, false);
      drawn.marker.place(owner.object3D.matrixWorld, drawn.anchor.pose);
    }
  }

  #wanted(): IterableIterator<ShownAnchor> {
    const { live, selection } = this.#options;
    const wanted = new Map<string, ShownAnchor>();
    function show(
      ownerId: string,
      component: string,
      anchor: Systems.ComponentAnchor,
      hanging: boolean
    ): void {
      const picked = actorAnchor(ownerId, { component, key: anchor.key });
      const key = actorAnchorKey(picked);
      if (hanging || !wanted.has(key)) {
        wanted.set(key, {
          picked,
          anchor,
          hanging
        });
      }
    }

    for (const id of selection.ids) {
      for (const { component, anchor } of live.anchors(id)) {
        show(id, component, anchor, false);
      }

      const file = live.actorEntry(id);
      if (file?.anchor === undefined || file.parentId === null) {
        continue;
      }
      const anchor = live.findAnchor(file.parentId, file.anchor);
      if (anchor !== null) {
        show(file.parentId, file.anchor.component, anchor, true);
      }
    }

    return wanted.values();
  }

  #clear(): void {
    for (const { marker } of this.#drawn) {
      this.#scene.remove(marker.root);
      marker.dispose();
    }
    this.#drawn = [];
  }
}
