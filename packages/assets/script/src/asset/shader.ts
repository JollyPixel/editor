// Import Third-party Dependencies
import type { AssetKindDescriptor } from "@jolly-pixel/asset-server";

// CONSTANTS
export const SHADER_KIND = "shader";
export const SHADER_COMMAND = "shader.command";
export const SHADER_EXTENSION = ".tsl.ts";
export const SHADER_CONTENT_TYPES = {
  ".tsl.ts": "text/typescript"
} as const;

export const SHADER_TEMPLATE = `import { color, mix, sin, time, uv } from "three/tsl";
import { Color, MeshStandardNodeMaterial } from "three/webgpu";

export const uniforms = {
  tint: new Color("#2f6fd6"),
  speed: 1
};

export default function material({ tint, speed }) {
  const material = new MeshStandardNodeMaterial();
  const wave = sin(time.mul(speed).add(uv().x.mul(6))).mul(0.5).add(0.5);
  material.colorNode = mix(tint, color("#d9822b"), wave);

  return material;
}
`;

export const SHADER_ASSET: AssetKindDescriptor = {
  kind: SHADER_KIND,
  label: "Shader",
  extension: SHADER_EXTENSION,
  icon: {
    svg: `
      <circle cx="32" cy="32" r="26" fill="#172033" />
      <circle cx="32" cy="32" r="22" fill="#2f6fd6" />
      <path
        d="M14 38 C22 26 30 46 38 32 S50 24 52 30"
        fill="none" stroke="#d9822b" stroke-width="4" stroke-linecap="round"
      />
      <circle cx="24" cy="22" r="5" fill="#e6ecf7" opacity="0.8" />
    `,
    viewBox: "0 0 64 64"
  }
};
