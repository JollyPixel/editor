// Import Third-party Dependencies
import type {
  Actor,
  Systems
} from "@jolly-pixel/engine";

// Import Internal Dependencies
import type { PhysicsBody } from "../PhysicsBody.ts";
import type { PhysicsCollider } from "../PhysicsCollider.ts";
import type {
  ContactEvent,
  PhysicsWorld,
  Ray,
  RayHit
} from "../PhysicsWorld.ts";

// CONSTANTS
const kSystems = new WeakMap<object, PhysicsSystem>();

export type EngineWorld = Systems.World<any, any>;

export interface PhysicsStepObserver {
  beforeStep?(): void;
  afterStep?(): void;
}

export interface ActorRayHit extends RayHit {
  actor: Actor<any> | null;
}

export interface ActorContact {
  started: boolean;
  collider: PhysicsCollider;
  other: PhysicsCollider;
  actor: Actor<any> | null;
}

export type ActorContactListener = (contact: ActorContact) => void;

interface BodyOwner {
  actor: Actor<any>;
  onContact?: ActorContactListener;
}

export class PhysicsSystem {
  static require(
    world: EngineWorld
  ): PhysicsSystem {
    const system = kSystems.get(world);
    if (system === undefined) {
      throw new Error("No PhysicsSystem is attached to this world.");
    }

    return system;
  }

  readonly physics: PhysicsWorld;

  #world: EngineWorld;
  #observers = new Set<PhysicsStepObserver>();
  #owners = new WeakMap<PhysicsBody, BodyOwner>();

  constructor(
    world: EngineWorld,
    physics: PhysicsWorld
  ) {
    if (kSystems.has(world)) {
      throw new Error("A PhysicsSystem is already attached to this world.");
    }

    this.#world = world;
    this.physics = physics;
    kSystems.set(world, this);
    world.on("afterFixedUpdate", this.#step);
  }

  ownedBodies(
    actor: Actor<any>,
    onContact?: ActorContactListener
  ): Pick<PhysicsWorld, "createBody"> {
    const owner = {
      actor,
      onContact
    };

    return {
      createBody: (desc) => {
        const body = this.physics.createBody(desc);
        this.#owners.set(body, owner);

        return body;
      }
    };
  }

  observeSteps(
    observer: PhysicsStepObserver
  ): () => void {
    const entry = { ...observer };
    this.#observers.add(entry);

    return () => {
      this.#observers.delete(entry);
    };
  }

  castRay(
    ray: Ray
  ): ActorRayHit | null {
    const hit = this.physics.castRay(ray);
    if (hit === null) {
      return null;
    }

    return {
      ...hit,
      actor: this.#owners.get(hit.collider.body)?.actor ?? null
    };
  }

  dispose(): void {
    this.#world.off("afterFixedUpdate", this.#step);
    kSystems.delete(this.#world);
    this.#observers.clear();
    this.physics.dispose();
  }

  #step = (
    seconds: number
  ): void => {
    for (const observer of this.#observers) {
      observer.beforeStep?.();
    }
    this.physics.step(seconds);
    for (const observer of this.#observers) {
      observer.afterStep?.();
    }
    this.physics.drainContacts(this.#dispatchContact);
  };

  #dispatchContact = (
    event: ContactEvent
  ): void => {
    const first = this.#owners.get(event.first.body);
    const second = this.#owners.get(event.second.body);

    first?.onContact?.({
      started: event.started,
      collider: event.first,
      other: event.second,
      actor: second?.actor ?? null
    });
    second?.onContact?.({
      started: event.started,
      collider: event.second,
      other: event.first,
      actor: first?.actor ?? null
    });
  };
}
