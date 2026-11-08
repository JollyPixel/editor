// Import Internal Dependencies
import { Matrix4 } from "../../../../math.ts";
import type { Actor } from "../../../../actor/Actor.ts";
import type { TransformSocket } from "../../../../actor/transform/Transform.ts";
import type {
  ComponentAnchor,
  ComponentAnchors,
  SceneActorAnchor
} from "../definitions/ComponentAnchors.ts";
import type { SceneAnchorFile } from "../SceneFile.ts";
import { composeSceneTransform } from "../sceneTransform.ts";

// CONSTANTS
const kOrigin = {
  x: 0,
  y: 0,
  z: 0
};
const kUnitScale = {
  x: 1,
  y: 1,
  z: 1
};

interface AnchorProvider {
  owner: Actor<any>;
  anchors: ComponentAnchors;
  unsubscribe: () => void;
}

export class AnchorSocket implements TransformSocket {
  static* within(
    owner: Actor<any>,
    component: string
  ): IterableIterator<[Actor<any>, AnchorSocket]> {
    for (const child of owner.children) {
      const { socket } = child.transform;
      if (
        socket instanceof AnchorSocket &&
        socket.anchor.component === component
      ) {
        yield [child, socket];
      }
    }
  }

  readonly anchor: Readonly<SceneAnchorFile>;
  readonly matrix = new Matrix4();

  constructor(
    anchor: SceneAnchorFile
  ) {
    this.anchor = {
      component: anchor.component,
      key: anchor.key
    };
  }

  place(
    anchor: ComponentAnchor | null
  ): void {
    composeSceneTransform(
      {
        position: anchor?.pose.position ?? kOrigin,
        rotation: anchor?.pose.rotation ?? kOrigin,
        scale: kUnitScale
      },
      this.matrix
    );
  }
}

export class SceneAnchors {
  #providers = new Map<string, AnchorProvider>();
  #changed: () => void;

  constructor(
    changed: () => void
  ) {
    this.#changed = changed;
  }

  provide(
    componentId: string,
    owner: Actor<any>,
    anchors: ComponentAnchors
  ): void {
    this.#drop(componentId);
    this.#providers.set(componentId, {
      owner,
      anchors,
      unsubscribe: anchors.subscribe(() => this.#refresh(componentId, owner))
    });
    this.#refresh(componentId, owner);
  }

  forget(
    componentId: string
  ): void {
    const owner = this.#drop(componentId);
    if (owner !== null) {
      this.#refresh(componentId, owner);
    }
  }

  * list(
    owner: Actor<any>
  ): IterableIterator<SceneActorAnchor> {
    for (const [component, provider] of this.#providers) {
      if (provider.owner !== owner) {
        continue;
      }
      for (const anchor of provider.anchors.list()) {
        yield {
          component,
          anchor
        };
      }
    }
  }

  find(
    owner: Actor<any>,
    anchor: SceneAnchorFile
  ): ComponentAnchor | null {
    const provider = this.#providers.get(anchor.component);
    if (provider?.owner !== owner) {
      return null;
    }

    for (const listed of provider.anchors.list()) {
      if (listed.key === anchor.key) {
        return listed;
      }
    }

    return null;
  }

  seat(
    actor: Actor<any>,
    owner: Actor<any>,
    anchor: SceneAnchorFile
  ): void {
    actor.transform.seat(this.#socket(owner, anchor));
  }

  #socket(
    owner: Actor<any>,
    anchor: SceneAnchorFile
  ): AnchorSocket {
    for (const [, socket] of AnchorSocket.within(owner, anchor.component)) {
      if (socket.anchor.key === anchor.key) {
        return socket;
      }
    }

    const socket = new AnchorSocket(anchor);
    socket.place(this.find(owner, anchor));

    return socket;
  }

  clear(): void {
    for (const provider of this.#providers.values()) {
      provider.unsubscribe();
    }
    this.#providers.clear();
  }

  #drop(
    componentId: string
  ): Actor<any> | null {
    const provider = this.#providers.get(componentId);
    if (provider === undefined) {
      return null;
    }

    provider.unsubscribe();
    this.#providers.delete(componentId);

    return provider.owner;
  }

  #refresh(
    componentId: string,
    owner: Actor<any>
  ): void {
    const listed = new Map<string, ComponentAnchor>();
    for (const anchor of this.#providers.get(componentId)?.anchors.list() ?? []) {
      listed.set(anchor.key, anchor);
    }
    for (const [child, socket] of AnchorSocket.within(owner, componentId)) {
      socket.place(listed.get(socket.anchor.key) ?? null);
      child.transform.seat(socket);
    }
    this.#changed();
  }
}
