// Import Internal Dependencies
import { Actor } from "../../../src/actor/Actor.ts";
import { ActorComponent } from "../../../src/actor/ActorComponent.ts";
import type {
  ComponentAnchor,
  ComponentAnchors,
  ComponentDefinition,
  JSONObject,
  Vector3JSON
} from "../../../src/systems/scene/file/index.ts";

export class MarkerAnchors implements ComponentAnchors {
  #anchors = new Map<string, ComponentAnchor>();
  #listeners = new Set<() => void>();

  place(
    key: string,
    position: Vector3JSON,
    rotationY = 0
  ): void {
    this.#anchors.set(key, {
      key,
      label: key,
      kind: "marker",
      pose: {
        position,
        rotation: { x: 0, y: rotationY, z: 0 }
      }
    });
    this.#notify();
  }

  remove(
    key: string
  ): void {
    this.#anchors.delete(key);
    this.#notify();
  }

  list(): Iterable<ComponentAnchor> {
    return this.#anchors.values();
  }

  subscribe(
    listener: () => void
  ): () => void {
    this.#listeners.add(listener);

    return () => this.#listeners.delete(listener);
  }

  #notify(): void {
    for (const listener of this.#listeners) {
      listener();
    }
  }
}

export class MarkersComponent extends ActorComponent {
  readonly anchors = new MarkerAnchors();

  constructor(
    actor: Actor
  ) {
    super({ actor, typeName: "Markers" });
  }
}

export const MARKERS_DEFINITION: ComponentDefinition<JSONObject, MarkersComponent> = {
  type: "Markers",
  parse: (data) => data,
  create: (actor, data) => {
    const markers = actor.addComponentAndGet(MarkersComponent);
    for (const [key, x] of Object.entries(data)) {
      if (typeof x === "number") {
        markers.anchors.place(key, { x, y: 0, z: 0 });
      }
    }

    return markers;
  },
  anchors: (component) => component.anchors
};
