// Import Third-party Dependencies
import {
  LightingNode,
  type Node,
  type NodeBuilder
} from "three/webgpu";
import {
  clamp,
  float,
  materialEmissive,
  max,
  property,
  uniform
} from "three/tsl";

export function createBlockLightUniforms() {
  return {
    strength: uniform(1),
    shadowFill: uniform(0),
    span: uniform(1)
  };
}

export type BlockLightUniforms = ReturnType<typeof createBlockLightUniforms>;

interface LightingContext {
  irradiance: Node<"vec3">;
  radiance: Node<"vec3">;
  iblIrradiance: Node<"vec3">;
}

interface PhysicalMaterial {
  isMeshStandardMaterial?: boolean;
}

export function emissionNode(
  albedo: Node<"vec3">
): Node<"vec3"> {
  return albedo.mul(materialEmissive);
}

export class BlockLightIrradianceNode extends LightingNode {
  readonly received = property("vec3", "BlockLight");
  readonly uniforms: BlockLightUniforms;

  constructor(
    uniforms: BlockLightUniforms
  ) {
    super();
    this.uniforms = uniforms;
  }

  override setup(
    builder: NodeBuilder
  ): null {
    const context = builder.context as unknown as LightingContext;
    const radiance = this.received.mul(this.uniforms.strength);
    const irradiance = radiance.mul(Math.PI);
    const material = builder.material as PhysicalMaterial | null;
    if (material?.isMeshStandardMaterial === true) {
      context.radiance.addAssign(radiance);
      context.iblIrradiance.addAssign(irradiance);
    }
    else {
      context.irradiance.addAssign(irradiance);
    }

    return null;
  }

  fillShadow() {
    const light = this.received.mul(this.uniforms.strength);
    const share = clamp(
      max(light.r, max(light.g, light.b)).mul(this.uniforms.shadowFill),
      float(0),
      float(1)
    );

    return (shadow: Node<"vec3">) => shadow.add(
      float(1).sub(shadow).mul(share)
    );
  }
}
