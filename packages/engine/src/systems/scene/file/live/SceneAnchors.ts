// Import Third-party Dependencies
import * as THREE from "three/webgpu";

// Import Internal Dependencies
import type { Actor } from "../../../../actor/Actor.ts";
import type {
  ComponentAnchor,
  ComponentAnchors,
  SceneActorAnchor
} from "../definitions/ComponentAnchors.ts";
import type { SceneAnchorFile } from "../SceneFile.ts";
import { writeSceneTransform } from "../sceneTransform.ts";

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

export class AnchorSocket extends THREE.Object3D {
  static* within(
    owner: Actor<any>,
    component: string
  ): IterableIterator<AnchorSocket> {
    for (const child of owner.object3D.children) {
      if (child instanceof AnchorSocket && child.anchor.component === component) {
        yield child;
      }
    }
  }

  readonly anchor: Readonly<SceneAnchorFile>;

  constructor(
    anchor: SceneAnchorFile
  ) {
    super();
    this.name = `Anchor:${anchor.key}`;
    this.anchor = {
      component: anchor.component,
      key: anchor.key
    };
    this.addEventListener("childremoved", () => {
      if (this.children.length === 0) {
        this.removeFromParent();
      }
    });
  }

  place(
    anchor: ComponentAnchor | null
  ): void {
    writeSceneTransform(this, {
      position: anchor?.pose.position ?? kOrigin,
      rotation: anchor?.pose.rotation ?? kOrigin,
      scale: kUnitScale
    });
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

  socket(
    owner: Actor<any>,
    anchor: SceneAnchorFile
  ): AnchorSocket {
    for (const socket of AnchorSocket.within(owner, anchor.component)) {
      if (socket.anchor.key === anchor.key) {
        return socket;
      }
    }

    const socket = new AnchorSocket(anchor);
    owner.object3D.add(socket);
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
    for (const socket of AnchorSocket.within(owner, componentId)) {
      socket.place(listed.get(socket.anchor.key) ?? null);
    }
    this.#changed();
  }
}
