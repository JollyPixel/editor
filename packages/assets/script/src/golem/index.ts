// Import Third-party Dependencies
import type { GolemKindList } from "@jolly-pixel/golem.kit";

// Import Internal Dependencies
import {
  SCRIPT_KIND,
  SHADER_KIND,
  TEXT_KIND
} from "../network/client.ts";
import type { TextAsset } from "./TextAsset.ts";
import { textGolemKind } from "./textGolemKind.ts";

export * from "./TextAsset.ts";
export * from "./errors/TextMatchError.ts";

declare module "@jolly-pixel/golem.kit" {
  interface GolemAssets {
    script: TextAsset<typeof SCRIPT_KIND>;
    shader: TextAsset<typeof SHADER_KIND>;
    text: TextAsset<typeof TEXT_KIND>;
  }
}

export const GOLEM_KINDS: GolemKindList = [
  textGolemKind(SCRIPT_KIND),
  textGolemKind(SHADER_KIND),
  textGolemKind(TEXT_KIND)
];
