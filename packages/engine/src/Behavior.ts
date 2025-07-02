// Import Internal Dependencies
import { ActorComponent } from "./ActorComponent.js";
import { Actor } from "./Actor.js";

export class Behavior extends ActorComponent {
  constructor(actor: Actor) {
    super({
      actor,
      typeName: "ScriptBehavior"
    });

    if (this.constructor.name in this.actor.behaviors) {
      this.actor.behaviors[this.constructor.name].push(this);
    }
    else {
      this.actor.behaviors[this.constructor.name] = [this];
    }
  }

  override destroy(): void {
    if (this.pendingForDestruction) {
      return;
    }

    const behaviorList = this.actor.behaviors[this.constructor.name];
    behaviorList.splice(behaviorList.indexOf(this), 1);
    if (behaviorList.length === 0) {
      delete this.actor.behaviors[this.constructor.name];
    }
    super.destroy();
  }
}
