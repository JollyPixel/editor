// Import Third-party Dependencies
import { Actor, ActorComponent } from "@jolly-pixel/engine";
// import * as THREE from "three";

export class TextRenderer extends ActorComponent {
  constructor(
    actor: Actor
  ) {
    super({
      actor,
      typeName: "TextRenderer"
    });
  }
}
