// Import Third-party Dependencies
import {
  Node,
  type NodeBuilder
} from "three/webgpu";

interface ShadowPassMaterial {
  isShadowPassMaterial?: boolean;
}

export class ShadowPassSwitchNode extends Node<"vec4"> {
  readonly main: Node<"vec4">;
  readonly caster: Node<"vec4">;

  constructor(
    main: Node<"vec4">,
    caster: Node<"vec4">
  ) {
    super("vec4");
    this.main = main;
    this.caster = caster;
  }

  override getNodeType(
    builder: NodeBuilder
  ): string {
    return this.#select(builder).getNodeType(builder);
  }

  override setup(
    builder: NodeBuilder
  ): Node<"vec4"> {
    return this.#select(builder);
  }

  #select(
    builder: NodeBuilder
  ): Node<"vec4"> {
    const material = builder.material as ShadowPassMaterial | null;

    return material?.isShadowPassMaterial === true ? this.caster : this.main;
  }
}

export function shadowPassSwitch(
  main: Node<"vec4">,
  caster: Node<"vec4">
): ShadowPassSwitchNode {
  return new ShadowPassSwitchNode(main, caster);
}
