// Import Third-party Dependencies
import {
  Fn,
  vec2,
  vec4,
  uv,
  texture,
  max,
  saturate
} from "three/tsl";

// Import Internal Dependencies
import { maskWeight } from "./maskWeight.ts";
import type { TslNode } from "./tslNode.ts";

export function buildEdgeDetection(
  maskDownSampleTexture: ReturnType<typeof texture>,
  invSizeNode: TslNode<"vec2">
) {
  return Fn(() => {
    const uvNode = uv();

    const c1 = maskDownSampleTexture.sample(uvNode.add(vec2(invSizeNode.x, 0))).toVar();
    const c2 = maskDownSampleTexture.sample(uvNode.sub(vec2(invSizeNode.x, 0))).toVar();
    const c3 = maskDownSampleTexture.sample(uvNode.add(vec2(0, invSizeNode.y))).toVar();
    const c4 = maskDownSampleTexture.sample(uvNode.sub(vec2(0, invSizeNode.y))).toVar();

    const diff1 = c1.rgb.sub(c2.rgb).length().mul(0.5);
    const diff2 = c3.rgb.sub(c4.rgb).length().mul(0.5);
    const edgeStrength = saturate(vec2(diff1, diff2).length());

    const w1 = maskWeight(c1);
    const w2 = maskWeight(c2);
    const w3 = maskWeight(c3);
    const w4 = maskWeight(c4);

    const colorSum = c1.rgb.mul(w1)
      .add(c2.rgb.mul(w2))
      .add(c3.rgb.mul(w3))
      .add(c4.rgb.mul(w4));
    const weightSum = w1.add(w2).add(w3).add(w4);
    const edgeColor = colorSum.div(max(weightSum, 0.0001));

    return vec4(edgeColor, 1).mul(edgeStrength);
  })();
}
