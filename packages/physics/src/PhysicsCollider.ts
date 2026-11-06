// Import Internal Dependencies
import type { PhysicsBody } from "./PhysicsBody.ts";

export interface PhysicsCollider {
  readonly body: PhysicsBody;
  readonly sensor: boolean;

  detach(): void;
}
