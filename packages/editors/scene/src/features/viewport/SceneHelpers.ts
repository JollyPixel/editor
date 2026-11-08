// Import Third-party Dependencies
import type * as THREE from "three";
import {
  ActorComponent,
  CameraComponent,
  LightComponent,
  type Actor,
  type Component
} from "@jolly-pixel/engine";
import { ColliderOutline } from "@jolly-pixel/physics/engine";
import type { Preferences } from "@jolly-pixel/preferences";

// Import Internal Dependencies
import { SCENE_PREFERENCES } from "../../preferences.ts";
import type {
  BoundComponent,
  SceneBinding
} from "../../scene/SceneBinding.ts";
import { CameraFrustum } from "./helpers/CameraFrustum.ts";
import type { ComponentHelper } from "./helpers/ComponentHelper.ts";
import { LightMarker } from "./helpers/LightMarker.ts";

export interface SceneHelpersOptions {
  binding: SceneBinding;
  preferences: Preferences;
}

interface DrawnHelper {
  helper: ComponentHelper;
  releasePick: () => void;
}

export class SceneHelpers extends ActorComponent {
  #binding: SceneBinding;
  #scene: THREE.Scene;
  #helpers = new Map<Component, DrawnHelper>();
  #preferences: Preferences;

  #add = (
    bound: BoundComponent
  ): void => {
    if (bound.component instanceof ColliderOutline) {
      bound.component.shown = this.#preferences
        .values(SCENE_PREFERENCES)
        .colliders;

      return;
    }

    const helper = createHelper(bound.component);
    if (helper === null) {
      return;
    }

    this.#helpers.set(bound.component, {
      helper,
      releasePick: this.#binding.addPickTarget(helper.root, bound.actorId)
    });
    this.#scene.add(helper.root);
  };

  #drop = (
    component: Component
  ): void => {
    const drawn = this.#helpers.get(component);
    if (drawn === undefined) {
      return;
    }

    this.#helpers.delete(component);
    drawn.releasePick();
    this.#scene.remove(drawn.helper.root);
    drawn.helper.dispose();
  };

  constructor(
    actor: Actor,
    options: SceneHelpersOptions
  ) {
    super({
      actor,
      typeName: "SceneHelpers"
    });
    this.#binding = options.binding;
    this.#scene = actor.world.sceneManager.graph.scene;
    this.#preferences = options.preferences;

    for (const bound of this.#binding.components()) {
      this.#add(bound);
    }
    this.#binding.on("componentBuilt", this.#add);
    this.#binding.on("componentDropped", this.#drop);
    this.addTeardown(this.#preferences.watch(SCENE_PREFERENCES, (values) => {
      for (const { component } of this.#binding.components()) {
        if (component instanceof ColliderOutline) {
          component.shown = values.colliders;
        }
      }
      actor.world.invalidate();
    }));
    this.addTeardown(() => {
      this.#binding.off("componentBuilt", this.#add);
      this.#binding.off("componentDropped", this.#drop);
      for (const component of [...this.#helpers.keys()]) {
        this.#drop(component);
      }
    });
  }

  update(): void {
    for (const [component, { helper }] of this.#helpers) {
      helper.root.visible = component.actor.transform.visibleInHierarchy;
      helper.sync();
    }
  }
}

function createHelper(
  component: Component
): ComponentHelper | null {
  if (component instanceof CameraComponent) {
    return new CameraFrustum(component);
  }
  if (component instanceof LightComponent) {
    return new LightMarker(component);
  }

  return null;
}
