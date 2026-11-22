// Import Internal Dependencies
import {
  type Actor,
  ActorComponent
} from "../../../src/actor/index.ts";

export class UpdateProbe extends ActorComponent {
  updates = 0;
  fixedUpdates = 0;
  onUpdate: () => void = () => undefined;
  onFixedUpdate: () => void = () => undefined;

  constructor(
    actor: Actor
  ) {
    super({ actor, typeName: "UpdateProbe" });
  }

  update() {
    this.updates++;
    this.onUpdate();
  }

  fixedUpdate() {
    this.fixedUpdates++;
    this.onFixedUpdate();
  }
}
