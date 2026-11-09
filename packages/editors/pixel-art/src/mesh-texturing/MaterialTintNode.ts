// Import Third-party Dependencies
import {
  Node,
  type NodeBuilder
} from "three/webgpu";
import {
  materialReference,
  vec3
} from "three/tsl";

export class MaterialTintNode extends Node<"vec3"> {
  readonly color = materialReference("color", "color") as unknown as Node<"vec3">;
  readonly colorless: Node<"vec3"> = vec3(1);

  constructor() {
    super("vec3");
  }

  override setup(
    builder: NodeBuilder
  ): Node<"vec3"> {
    return "color" in builder.material ?
      this.color :
      this.colorless;
  }
}
